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
const { getCandidates } = require('./candidateService');
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
async function recommend({ userId, location, mood, isPremium = false }) {
  const tier = isPremium ? 'premium' : 'free';
  const model = modelForTier(tier);

  // 1. Adaylar
  const { candidates, meta: candMeta } = await getCandidates(userId, location);
  if (!candidates.length) {
    return { noCandidates: true, meta: { candidates: candMeta } };
  }

  // 2. Prompt
  const profileSummary = await buildUserProfileSummary(userId);
  const req = buildClaudeRequest({ profileSummary, candidates, location, mood });

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

  // 5. Audit log
  const usage = summarizeUsage(model, response.usage);
  try {
    await prisma.aiRecommendationLog.create({
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
        mood: mood || null,
        lat: location.lat,
        lng: location.lng,
        responseJson: parsed ?? { raw: textBlock?.text?.slice(0, 1000) },
      },
    });
  } catch (logErr) {
    // Audit log fail'i öneri akışını bozmasın — ama console'a yazılsın
    console.error('[recommend] AiRecommendationLog write failed:', logErr.message);
  }

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

module.exports = {
  MODELS,
  PRICING,
  MAX_OUTPUT_TOKENS,
  getClient,
  modelForTier,
  summarizeUsage,
  logUsage,
  recommend,
  // testable
  __test: {
    parseLlmJson,
  },
};
