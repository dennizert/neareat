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
      candidate,
    });
  }

  // Kartları birer birer emit et
  for (const r of validRecs) {
    onCard({
      placeId: r.placeId,
      reason: r.reason,
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

  const { waypoints, totalDistanceKm, totalDurationMin } = routeData;
  const tier = isPremium ? 'premium' : 'free';
  const model = modelForTier(tier);

  // Waypoint arrival times — fraction = (i+1)/(n+1) → [0.25, 0.50, 0.75] for 3 waypoints
  const waypointArrivalTimes = new Map();
  const departureMs = departureTime ? new Date(departureTime).getTime() : null;
  if (departureMs && !isNaN(departureMs)) {
    for (let i = 0; i < waypoints.length; i++) {
      const fraction = (i + 1) / (waypoints.length + 1);
      waypointArrivalTimes.set(i, departureMs + fraction * totalDurationMin * 60 * 1000);
    }
  }

  // Her ara nokta için aday çek — ardışık (Redis cache sayesinde tekrar noktalar hızlı)
  const wpCandidatesAll = [];
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const result = await getCandidates(userId, { lat: wp.lat, lng: wp.lng });
    for (const c of result.candidates) {
      wpCandidatesAll.push({ ...c, waypointIndex: i });
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

  // Rota akışına göre sırala (origin → ara nokta → ...)
  validRecs.sort((a, b) => a.waypointIndex - b.waypointIndex);

  // Fire-and-forget audit log
  const usage = summarizeUsage(model, response.usage);
  prisma.aiRecommendationLog
    .create({
      data: {
        userId,
        model,
        candidatePlaceIds: candidates.map((c) => c.placeId),
        suggestedPlaceIds: validRecs.map((r) => r.placeId),
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
    recommendations: validRecs.map((r) => ({
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
  },
};
