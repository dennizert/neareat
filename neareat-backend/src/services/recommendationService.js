/**
 * AI Yemek Önerisi Servisi (Sprint-1 Task #2 iskelet + Task #5 implementation).
 *
 * Bu modül LLM çağrısının tüm yaşam döngüsünü yönetir:
 *   - candidateService → aday daraltma
 *   - promptBuilder    → cache-optimize prompt
 *   - Anthropic API    → LLM çağrısı
 *   - response parsing → JSON ayrıştırma + halüsinasyon filtresi
 *   - AiRecommendationLog → audit + rate limit kaynağı
 *
 * Detaylı mimari: memory/project_ai_recommender.md
 */

const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../utils/prisma');
const { getCandidates, MAX_CANDIDATES } = require('./candidateService');
const { getRouteWaypoints, getPlaceDetails, isOpenAtTime } = require('./googlePlaces');
const { buildUserProfileSummary, buildClaudeRequest } = require('./promptBuilder');
const { haversineKm } = require('../utils/haversine');

const MODELS = Object.freeze({
  free: 'claude-haiku-4-5-20251001',
  premium: 'claude-sonnet-4-6',
});

/**
 * Anthropic input token fiyatı ($ / 1M token).
 * Haiku 4.5: $1.00 in / $5.00 out
 * Sonnet 4.6: $3.00 in / $15.00 out
 * Cache write: 1.25x base input; Cache read: 0.1x base input
 */
const PRICING = Object.freeze({
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
});

let _client = null;

/**
 * Lazy client. Module load sırasında env zorunlu değil — gerçek çağrıda kontrol edilir.
 * Test/CI'de ANTHROPIC_API_KEY olmadan da modül require edilebilir.
 */
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. ' +
        'AI öneri motoru kullanılamaz. .env dosyasına Anthropic API key ekleyin.'
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Tier (free|premium) → kullanılacak model id'si
 */
function modelForTier(tier) {
  if (tier === 'premium') return MODELS.premium;
  return MODELS.free;
}

/**
 * Anthropic response.usage'tan token + tahmini maliyet özetini çıkarır.
 * Maliyet kabaca hesaplanır; gerçek fatura console.anthropic.com'da görünür.
 *
 * @param {string} model
 * @param {object} usage - Anthropic response.usage
 * @returns {{ inputTokens, outputTokens, cachedTokens, estimatedCostUsd }}
 */
function summarizeUsage(model, usage) {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cachedTokens = usage?.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage?.cache_creation_input_tokens ?? 0;

  const pricing = PRICING[model] || { input: 0, output: 0 };
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheWriteTokens / 1_000_000) * pricing.input * 1.25 +
    (cachedTokens / 1_000_000) * pricing.input * 0.1;

  return {
    inputTokens,
    outputTokens,
    cachedTokens,
    cacheWriteTokens,
    estimatedCostUsd: Number(costUsd.toFixed(6)),
  };
}

/**
 * Konsola standart formatta usage log'u basar (audit için console hattı).
 * Asıl audit kalıcılığı RecommendationLog tablosunda yapılır (Task #5).
 */
function logUsage({ userId, model, usage, latencyMs }) {
  const s = summarizeUsage(model, usage);
  console.log(
    `[recommend] user=${userId} model=${model} ` +
      `in=${s.inputTokens} out=${s.outputTokens} cached=${s.cachedTokens} ` +
      `latency=${latencyMs}ms cost=$${s.estimatedCostUsd}`
  );
  return s;
}

const MAX_OUTPUT_TOKENS = 1024;

// Turkey is UTC+3 year-round (no DST)
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

function istanbulTimeAtMs(timestampMs) {
  const d = new Date(timestampMs + ISTANBUL_OFFSET_MS);
  const dayOfWeek = d.getUTCDay();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return { dayOfWeek, timeHHMM: hh + mm };
}

/**
 * Fetches Place Details for each candidate (concurrency=3) and attaches:
 *   detourKm = round(distanceKm * 2, 1)  — rough round-trip off-route estimate
 *   openAtArrival = true | false | null   — null when periods missing or fetch fails
 *
 * @param {Array} candidates
 * @param {Map<number,number>} waypointArrivalTimes  — waypointIndex → timestampMs
 */
async function enrichOpenAtArrival(candidates, waypointArrivalTimes) {
  const enriched = [];
  for (let i = 0; i < candidates.length; i += 3) {
    const batch = candidates.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (c) => {
        const detourKm = Math.round(c.distanceKm * 2 * 10) / 10;
        const arrivalMs = waypointArrivalTimes.get(c.waypointIndex ?? 0);
        if (arrivalMs == null) return { ...c, detourKm, openAtArrival: null };
        try {
          const details = await getPlaceDetails(c.placeId);
          const periods = details?.opening_hours?.periods;
          const { dayOfWeek, timeHHMM } = istanbulTimeAtMs(arrivalMs);
          return { ...c, detourKm, openAtArrival: isOpenAtTime(periods, dayOfWeek, timeHHMM) };
        } catch {
          return { ...c, detourKm, openAtArrival: null };
        }
      })
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        enriched.push(results[j].value);
      } else {
        enriched.push({ ...batch[j], detourKm: Math.round(batch[j].distanceKm * 2 * 10) / 10, openAtArrival: null });
      }
    }
  }
  return enriched;
}

/**
 * LLM JSON response'unu temizle ve parse et.
 * Sistem promptu markdown yasakladı ama bazen LLM ```json ... ``` ekleyebilir;
 * defensive olarak strip ediyoruz.
 *
 * @param {string} text
 * @returns {object|null}
 */
function parseLlmJson(text) {
  if (!text) return null;
  let cleaned = text.trim();
  // Code fence stripping
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // İlk { ile son } arası — preamble/postamble guard'ı
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const jsonStr = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Ana giriş — kullanıcıya yemek önerisi getir.
 *
 * Akış:
 *   1. tier belirle (free/premium)
 *   2. getCandidates → max 20 aday
 *   3. aday yoksa { noCandidates: true } döner (controller 404 verir)
 *   4. buildUserProfileSummary + buildClaudeRequest
 *   5. Anthropic API call
 *   6. JSON parse + halüsinasyon filtresi (placeId aday listede mi?)
 *   7. AiRecommendationLog → audit
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {{ lat: number, lng: number }} params.location
 * @param {string} [params.mood] - opsiyonel: 'hızlı'|'şık'|'romantik'|'aile'|...
 * @param {boolean} [params.isPremium=false] - controller'dan geliyor
 * @returns {Promise<object>}
 */
async function recommend({ userId, location, isPremium = false }) {
  const tier = isPremium ? 'premium' : 'free';
  const model = modelForTier(tier);

  // 1. Adaylar
  const { candidates, meta: candMeta } = await getCandidates(userId, location);
  if (!candidates.length) {
    return { noCandidates: true, meta: { candidates: candMeta } };
  }

  // 2. Prompt (premium'da arkadaş sinyalleri dahil edilir)
  const profileSummary = await buildUserProfileSummary(userId, { tier });
  const req = buildClaudeRequest({ profileSummary, candidates, location });

  // 3. LLM
  const client = getClient();
  const t0 = Date.now();
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: req.system,
      messages: req.messages,
    });
  } catch (err) {
    // Anthropic hatasını taşırken context bilgisini koru
    err.context = { userId, model, latencyMs: Date.now() - t0 };
    throw err;
  }
  const latencyMs = Date.now() - t0;

  // 4. Parse + halüsinasyon filtresi
  const textBlock = response.content?.find((b) => b.type === 'text');
  const parsed = parseLlmJson(textBlock?.text);
  const rawRecs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const candidatesByPlaceId = new Map(candidates.map((c) => [c.placeId, c]));

  // Aday listesinde olan placeId'ler → halüsinasyon filtresi
  const validRecs = [];
  const seen = new Set();
  for (const rec of rawRecs) {
    if (!rec?.placeId || typeof rec.placeId !== 'string') continue;
    if (seen.has(rec.placeId)) continue; // duplicate placeId guard
    const candidate = candidatesByPlaceId.get(rec.placeId);
    if (!candidate) continue; // halüsinasyon — listede olmayan placeId
    seen.add(rec.placeId);
    validRecs.push({
      placeId: rec.placeId,
      reason: typeof rec.reason === 'string' ? rec.reason.trim() : '',
      neverVisited: candidate.neverVisited ?? false,
      candidate,
    });
  }

  // 5. Audit log — fire-and-forget (Sprint-2 Task #2).
  // DB write'ı await ETMEZ; response gönderildikten sonra event loop'ta tamamlanır.
  // Hata olursa console'a yazılır, kullanıcı akışı bozulmaz.
  const usage = summarizeUsage(model, response.usage);
  prisma.aiRecommendationLog
    .create({
      data: {
        userId,
        model,
        candidatePlaceIds: candidates.map((c) => c.placeId),
        suggestedPlaceIds: validRecs.map((r) => r.placeId),
        promptTokens: (response.usage?.input_tokens || 0) +
                      (response.usage?.cache_creation_input_tokens || 0) +
                      (response.usage?.cache_read_input_tokens || 0),
        completionTokens: response.usage?.output_tokens || 0,
        cachedTokens: response.usage?.cache_read_input_tokens || 0,
        latencyMs,
        mood: null,
        lat: location.lat,
        lng: location.lng,
        responseJson: parsed ?? { raw: textBlock?.text?.slice(0, 1000) },
      },
    })
    .catch((logErr) => {
      console.error('[recommend] AiRecommendationLog write failed:', logErr.message);
    });

  logUsage({ userId, model, usage: response.usage, latencyMs });

  return {
    recommendations: validRecs,
    noteToUser: typeof parsed?.noteToUser === 'string' ? parsed.noteToUser.trim() : '',
    tier,
    model,
    latencyMs,
    usage,
    meta: {
      candidatesCount: candidates.length,
      llmReturned: rawRecs.length,
      validRecs: validRecs.length,
    },
  };
}

/**
 * Streaming versiyonu — her öneri kartı hazır olduğunda callbacks ile emit eder.
 * Controller, SSE `data:` satırlarını doğrudan yazabilir.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {{ lat: number, lng: number }} p.location
 * @param {string} [p.mood]
 * @param {boolean} [p.isPremium=false]
 * @param {{ abort: Function|null }} p.abortRef  - req.on('close') için dışarıdan bağlanır
 * @param {(rec: object) => void} p.onCard
 * @param {(note: string) => void} p.onNote
 * @param {(meta: object) => void} p.onDone
 * @returns {Promise<{ noCandidates?: true }>}
 */
async function recommendStream({ userId, location, isPremium = false, abortRef, onCard, onNote, onDone }) {
  const tier = isPremium ? 'premium' : 'free';
  const model = modelForTier(tier);

  const { candidates, meta: candMeta } = await getCandidates(userId, location);
  if (!candidates.length) {
    return { noCandidates: true, meta: { candidates: candMeta } };
  }

  const profileSummary = await buildUserProfileSummary(userId, { tier });
  const req = buildClaudeRequest({ profileSummary, candidates, location });

  const client = getClient();
  const t0 = Date.now();

  const stream = client.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: req.system,
    messages: req.messages,
  });

  // Dışarıdan abort edilebilsin (req.on('close'))
  if (abortRef) abortRef.abort = () => stream.abort();

  let finalMsg;
  try {
    finalMsg = await stream.finalMessage();
  } catch (err) {
    err.context = { userId, model, latencyMs: Date.now() - t0 };
    throw err;
  }
  const latencyMs = Date.now() - t0;

  const textBlock = finalMsg.content?.find((b) => b.type === 'text');
  const parsed = parseLlmJson(textBlock?.text);
  const rawRecs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const candidatesByPlaceId = new Map(candidates.map((c) => [c.placeId, c]));

  const validRecs = [];
  const seen = new Set();
  for (const rec of rawRecs) {
    if (!rec?.placeId || typeof rec.placeId !== 'string') continue;
    if (seen.has(rec.placeId)) continue;
    const candidate = candidatesByPlaceId.get(rec.placeId);
    if (!candidate) continue;
    seen.add(rec.placeId);
    validRecs.push({
      placeId: rec.placeId,
      reason: typeof rec.reason === 'string' ? rec.reason.trim() : '',
      neverVisited: candidate.neverVisited ?? false,
      candidate,
    });
  }

  // Kartları birer birer emit et
  for (const r of validRecs) {
    onCard({
      placeId: r.placeId,
      reason: r.reason,
      neverVisited: r.neverVisited ?? false,
      restaurant: {
        name: r.candidate.name,
        types: r.candidate.types,
        rating: r.candidate.rating,
        userRatingsTotal: r.candidate.userRatingsTotal,
        priceLevel: r.candidate.priceLevel,
        vicinity: r.candidate.vicinity,
        location: r.candidate.location,
        distanceKm: r.candidate.distanceKm,
        openNow: r.candidate.openNow,
        photoUrl: r.candidate.photoUrl ?? null,
      },
    });
  }

  const noteToUser = typeof parsed?.noteToUser === 'string' ? parsed.noteToUser.trim() : '';
  if (noteToUser) onNote(noteToUser);

  // Fire-and-forget audit log
  const usage = summarizeUsage(model, finalMsg.usage);
  prisma.aiRecommendationLog
    .create({
      data: {
        userId,
        model,
        candidatePlaceIds: candidates.map((c) => c.placeId),
        suggestedPlaceIds: validRecs.map((r) => r.placeId),
        promptTokens:
          (finalMsg.usage?.input_tokens || 0) +
          (finalMsg.usage?.cache_creation_input_tokens || 0) +
          (finalMsg.usage?.cache_read_input_tokens || 0),
        completionTokens: finalMsg.usage?.output_tokens || 0,
        cachedTokens: finalMsg.usage?.cache_read_input_tokens || 0,
        latencyMs,
        mood: null,
        lat: location.lat,
        lng: location.lng,
        responseJson: parsed ?? { raw: textBlock?.text?.slice(0, 1000) },
      },
    })
    .catch((logErr) => {
      console.error('[recommendStream] AiRecommendationLog write failed:', logErr.message);
    });

  logUsage({ userId, model, usage: finalMsg.usage, latencyMs });

  onDone({ tier, model, latencyMs, usage });

  return {};
}

/**
 * Uzun rota (≥300 km) için zone-dağıtım enforcement.
 *
 * Mantık:
 *   1. LLM önerilerini zone'a göre grupla (1, 2, 3)
 *   2. Her zone için: o zone'dan LLM seçimi varsa onu kullan;
 *      yoksa o zone'un en iyi adayını manuel ekle (LLM gerekçesi olmaz)
 *   3. Eksik kalırsa (zone boş) → en çok adaylı zone'dan haversine
 *      ≥ 0.45x kuralına uyan en iyi adayla 3'e tamamla
 *
 * Min-gap:
 *   - Zone'lar arası zaten yapı gereği ≥1.33x route-distance ⇒ 0.75x'i sağlar
 *   - Aynı zone'dan iki pick gerekirse haversine ≥ 0.45x (kıvrımlı rota
 *     yaklaşımı; gerçek route-projection olmadan en pragmatik eşik)
 *
 * @param {Array} validRecs - LLM'den dönen ve filtrelenmiş öneriler
 * @param {Array} candidates - Tüm adaylar (zone tag'li)
 * @param {number} xKm - x = D/8, totalDistanceKm / 8
 * @returns {Array} - Düzenlenmiş öneri listesi
 */
function enforceZoneDiversity(validRecs, candidates, xKm) {
  const TARGET_COUNT = 3;
  const ZONE_COUNT = 3;
  const FALLBACK_MIN_HAVERSINE_KM = 0.45 * xKm;

  // Adayları zone'a göre grupla + her zone'u skor desc sırala
  const candidatesByZone = new Map();
  for (let z = 1; z <= ZONE_COUNT; z++) candidatesByZone.set(z, []);
  for (const c of candidates) {
    const z = c.zoneIndex;
    if (z >= 1 && z <= ZONE_COUNT) candidatesByZone.get(z).push(c);
  }
  for (const z of candidatesByZone.keys()) {
    candidatesByZone.get(z).sort((a, b) => b.score - a.score);
  }

  // LLM seçimlerini zone'a göre grupla (sıralı; her zone'da LLM seçimi içinden ilki)
  const llmPicksByZone = new Map();
  for (let z = 1; z <= ZONE_COUNT; z++) llmPicksByZone.set(z, []);
  for (const rec of validRecs) {
    const z = rec.candidate?.zoneIndex;
    if (z >= 1 && z <= ZONE_COUNT) llmPicksByZone.get(z).push(rec);
  }

  const finalPicks = [];
  const pickedIds = new Set();

  // Adım 1 — Her zone'dan tek pick (LLM tercih, yoksa o zone'un en iyisi)
  for (let z = 1; z <= ZONE_COUNT; z++) {
    const llmInZone = llmPicksByZone.get(z);
    if (llmInZone.length > 0) {
      const pick = llmInZone[0];
      finalPicks.push(pick);
      pickedIds.add(pick.placeId);
    } else if (candidatesByZone.get(z).length > 0) {
      // LLM bu zone'dan seçmedi ama aday var → en iyi adayı manuel ekle
      const top = candidatesByZone.get(z)[0];
      finalPicks.push({
        placeId: top.placeId,
        reason: '', // LLM gerekçesi yok — boş bırakılır, frontend handle eder
        candidate: top,
        waypointIndex: top.waypointIndex ?? 0,
      });
      pickedIds.add(top.placeId);
    }
    // else: zone fully boş → bu adımda atlanır, fallback'te ele alınır
  }

  // Adım 2 — Eksik kalırsa (zone boştu) → diğer zone'lardan haversine kuralıyla doldur
  if (finalPicks.length < TARGET_COUNT) {
    // En çok adaylı (kullanılmamış) zone'dan başla, sıraya devam et
    const remaining = [...candidatesByZone.entries()]
      .map(([z, cands]) => ({
        z,
        cands: cands.filter((c) => !pickedIds.has(c.placeId)),
      }))
      .filter(({ cands }) => cands.length > 0)
      .sort((a, b) => b.cands.length - a.cands.length);

    outer: while (finalPicks.length < TARGET_COUNT) {
      let progressed = false;
      for (const entry of remaining) {
        if (finalPicks.length >= TARGET_COUNT) break outer;
        while (entry.cands.length > 0) {
          const next = entry.cands.shift();
          // Halihazırda picked olanlardan haversine ≥ eşik?
          const okGap = finalPicks.every((p) => {
            if (!p.candidate?.location || !next.location) return true;
            const d = haversineKm(
              next.location.lat,
              next.location.lng,
              p.candidate.location.lat,
              p.candidate.location.lng,
            );
            return d >= FALLBACK_MIN_HAVERSINE_KM;
          });
          if (okGap) {
            finalPicks.push({
              placeId: next.placeId,
              reason: '',
              candidate: next,
              waypointIndex: next.waypointIndex ?? 0,
            });
            pickedIds.add(next.placeId);
            progressed = true;
            break;
          }
        }
      }
      if (!progressed) break; // tüm uygun adaylar tüketildi
    }
  }

  return finalPicks;
}

/**
 * Rota üzerinde yemek önerisi — "yolda ne yesem?" (Sprint-3 Task #6).
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {{ lat: number, lng: number }} p.origin
 * @param {{ lat: number, lng: number }} p.destination
 * @param {string} [p.mood]
 * @param {boolean} [p.isPremium=false]
 * @returns {Promise<object>}
 *   { noRoute: true } → Directions API rota bulamadı
 *   { noCandidates: true } → Rota boyunca aday yok
 *   Başarılı: { recommendations, noteToUser, totalRouteDistanceKm, totalRouteDurationMin, tier, model, latencyMs, usage }
 */
async function recommendForRoute({ userId, origin, destination, departureTime, isPremium = false }) {
  const routeData = await getRouteWaypoints(origin.lat, origin.lng, destination.lat, destination.lng);
  if (!routeData || !routeData.waypoints.length) {
    return { noRoute: true };
  }

  const { waypoints, totalDistanceKm, totalDurationMin, isLongRoute, xKm } = routeData;
  const tier = isPremium ? 'premium' : 'free';
  const model = modelForTier(tier);

  // Waypoint arrival times — long route'da waypoint'ler %33/%50/%67'de;
  // kısa route'da %25/%50/%75. distanceFromStartKm zaten waypoint'te var,
  // bunu duration ile orantılayarak arrival time çıkarıyoruz.
  const waypointArrivalTimes = new Map();
  const departureMs = departureTime ? new Date(departureTime).getTime() : null;
  if (departureMs && !isNaN(departureMs)) {
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const fraction = totalDistanceKm > 0 ? wp.distanceFromStartKm / totalDistanceKm : 0.5;
      waypointArrivalTimes.set(i, departureMs + fraction * totalDurationMin * 60 * 1000);
    }
  }

  // Her ara nokta için aday çek — adaylar waypoint'in zoneIndex'i ve
  // projectedKm'siyle (waypoint'in distanceFromStartKm) etiketlenir.
  const wpCandidatesAll = [];
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const result = await getCandidates(userId, { lat: wp.lat, lng: wp.lng });
    for (const c of result.candidates) {
      wpCandidatesAll.push({
        ...c,
        waypointIndex: i,
        zoneIndex: wp.zoneIndex,            // 1|2|3 (uzun route) ya da null
        projectedKm: wp.distanceFromStartKm, // rota üzerindeki konum
      });
    }
  }

  // Dedupe: aynı placeId için en yüksek score'lu kaydı tut
  const candidateMap = new Map();
  for (const c of wpCandidatesAll) {
    const existing = candidateMap.get(c.placeId);
    if (!existing || c.score > existing.score) {
      candidateMap.set(c.placeId, c);
    }
  }
  let candidates = [...candidateMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  if (!candidates.length) {
    return { noCandidates: true };
  }

  // Enrich each candidate: detourKm + openAtArrival from Place Details
  candidates = await enrichOpenAtArrival(candidates, waypointArrivalTimes);

  // If ≥3 candidates are open at arrival time, drop definitely-closed ones
  const openCandidates = candidates.filter((c) => c.openAtArrival !== false);
  if (openCandidates.length >= 3) {
    candidates = openCandidates;
  }

  const profileSummary = await buildUserProfileSummary(userId, { tier });

  // Route context for Claude — include departure/arrival hint when available
  const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  let routeContext =
    `Rota uzunluğu: ~${totalDistanceKm} km, ~${totalDurationMin} dakika.\n` +
    `Adaylar rotanın orta bölümünden seçildi (çıkış ve varış noktasından ~${Math.round(totalDistanceKm / 4)} km uzakta).\n`;
  let nowOverride;
  if (departureMs && !isNaN(departureMs)) {
    const midArrivalMs = departureMs + 0.5 * totalDurationMin * 60 * 1000;
    const { dayOfWeek, timeHHMM } = istanbulTimeAtMs(midArrivalMs);
    routeContext +=
      `Tahmini rota orta noktasına ulaşım: ${DAY_NAMES[dayOfWeek]} ~${timeHHMM.slice(0, 2)}:${timeHHMM.slice(2)} (Türkiye saati).\n` +
      `Kesinlikle kapalı restoranlar filtrelendi; geri kalanlar bu saatte açık veya açılış bilgisi belirsiz.\n`;
    nowOverride = new Date(midArrivalMs).toISOString();
  }
  routeContext += `Önerirken yolda kolayca durulabilecek, rotaya yakın yerleri tercih et.`;

  // Uzun rota (≥300 km): zone-dağıtım talimatı
  if (isLongRoute) {
    routeContext +=
      `\n\nUZUN ROTA DAĞITIM KURALI (zorunlu):\n` +
      `Bu rota 3 eşit zone'a bölündü (orta segment). Adaylar zone 1, 2 ve 3 etiketli.\n` +
      `Tam 3 öneri seç ve her zone'dan EN AZ 1 tane olacak şekilde dağıt.\n` +
      `Aynı zone'dan birden fazla seçme — kullanıcı rota boyunca farklı noktalarda durmak istiyor.`;
  }

  const req = buildClaudeRequest({ profileSummary, candidates, location: origin, routeContext, now: nowOverride });

  const client = getClient();
  const t0 = Date.now();
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: req.system,
      messages: req.messages,
    });
  } catch (err) {
    err.context = { userId, model, latencyMs: Date.now() - t0 };
    throw err;
  }
  const latencyMs = Date.now() - t0;

  const textBlock = response.content?.find((b) => b.type === 'text');
  const parsed = parseLlmJson(textBlock?.text);
  const rawRecs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const candidatesByPlaceId = new Map(candidates.map((c) => [c.placeId, c]));

  const validRecs = [];
  const seen = new Set();
  for (const rec of rawRecs) {
    if (!rec?.placeId || typeof rec.placeId !== 'string') continue;
    if (seen.has(rec.placeId)) continue;
    const candidate = candidatesByPlaceId.get(rec.placeId);
    if (!candidate) continue;
    seen.add(rec.placeId);
    validRecs.push({
      placeId: rec.placeId,
      reason: typeof rec.reason === 'string' ? rec.reason.trim() : '',
      candidate,
      waypointIndex: candidate.waypointIndex ?? 0,
    });
  }

  // Uzun rota: zone-dağıtım enforcement (LLM önerilerini düzeltir).
  // Kısa rotalarda dokunulmaz.
  const finalRecs = isLongRoute
    ? enforceZoneDiversity(validRecs, candidates, xKm)
    : validRecs;

  // Rota akışına göre sırala (origin → ara nokta → ...)
  finalRecs.sort((a, b) => a.waypointIndex - b.waypointIndex);

  // Fire-and-forget audit log
  const usage = summarizeUsage(model, response.usage);
  prisma.aiRecommendationLog
    .create({
      data: {
        userId,
        model,
        candidatePlaceIds: candidates.map((c) => c.placeId),
        suggestedPlaceIds: finalRecs.map((r) => r.placeId),
        promptTokens:
          (response.usage?.input_tokens || 0) +
          (response.usage?.cache_creation_input_tokens || 0) +
          (response.usage?.cache_read_input_tokens || 0),
        completionTokens: response.usage?.output_tokens || 0,
        cachedTokens: response.usage?.cache_read_input_tokens || 0,
        latencyMs,
        mood: null,
        lat: origin.lat,
        lng: origin.lng,
        responseJson: parsed ?? { raw: textBlock?.text?.slice(0, 1000) },
      },
    })
    .catch((logErr) => {
      console.error('[recommendForRoute] AiRecommendationLog write failed:', logErr.message);
    });

  logUsage({ userId, model, usage: response.usage, latencyMs });

  return {
    recommendations: finalRecs.map((r) => ({
      ...r,
      detourKm: r.candidate.detourKm ?? null,
      openAtArrival: r.candidate.openAtArrival ?? null,
    })),
    noteToUser: typeof parsed?.noteToUser === 'string' ? parsed.noteToUser.trim() : '',
    totalRouteDistanceKm: totalDistanceKm,
    totalRouteDurationMin: totalDurationMin,
    tier,
    model,
    latencyMs,
    usage,
  };
}

module.exports = {
  MODELS,
  PRICING,
  MAX_OUTPUT_TOKENS,
  getClient,
  modelForTier,
  summarizeUsage,
  logUsage,
  recommend,
  recommendStream,
  recommendForRoute,
  // testable
  __test: {
    parseLlmJson,
    enforceZoneDiversity,
  },
};
