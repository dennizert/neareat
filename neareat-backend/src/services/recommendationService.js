/**
 * AI Yemek Önerisi Servisi (iskelet — Sprint-1 Task #2)
 *
 * Bu modül Claude API ile konuşur. Şu an sadece iskelet:
 *   - Lazy Anthropic client (env'de key yokken bile require edilebilir)
 *   - Model sabitleri (free=Haiku, premium=Sonnet) — Opus YOK
 *   - recommend() henüz boş, Task #5'te dolacak
 *   - logUsage() — her response'da token + maliyet izleme
 *
 * Detaylı mimari: memory/project_ai_recommender.md
 */

const Anthropic = require('@anthropic-ai/sdk');

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

/**
 * Ana giriş — kullanıcıya yemek önerisi getir.
 * Task #5'te tam olarak doldurulacak: candidate filtering + prompt build + Claude çağrısı + log.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {{ lat: number, lng: number }} params.location
 * @param {object} [params.options]
 * @param {'free'|'premium'} [params.options.tier='free']
 * @param {string} [params.options.mood]
 * @returns {Promise<{ recommendations: Array, remainingToday: number }>}
 */
// eslint-disable-next-line no-unused-vars
async function recommend({ userId, location, options = {} }) {
  throw new Error('recommend() not implemented — Sprint-1 Task #5 kapsamında doldurulacak');
}

module.exports = {
  MODELS,
  PRICING,
  getClient,
  modelForTier,
  summarizeUsage,
  logUsage,
  recommend,
};
