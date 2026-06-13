'use strict';

/**
 * Hafif uygulama metrikleri kayıt defteri — S16-2.
 *
 * Neden: Sentry yalnızca HATA görüyor; 10k kullanıcı kararları (replika ekleme, DB
 * plan, AI/Google maliyet) için PERFORMANS metriği gerekir — p50/p95 latency, 5xx
 * oranı, Redis isabet, dış-API harcaması, event-loop gecikmesi. Bu modül bunları
 * IN-MEMORY (sınırlı bellek) toplar; `GET /api/admin/metrics` ile sunulur ve eşik
 * aşımında alarm üretir.
 *
 * Tasarım: tüm sayaçlar süreç-içi (process-local). Yatay ölçeklemede (S16-8) her
 * replika kendi metriğini tutar — admin endpoint hangi replikaya düşerse onun
 * anlık görüntüsünü verir; toplulaştırma ileride dış sink ile yapılabilir.
 * Düşük ek yük: yalnızca sayaç++ ve sınırlı kayan pencere (alloc yok).
 */

let monitorEventLoopDelay;
try { ({ monitorEventLoopDelay } = require('perf_hooks')); } catch { monitorEventLoopDelay = null; }

// Latency kayan penceresi — bounded; en eski örnek düşer (sınırsız büyüme yok).
const MAX_SAMPLES = 1000;
const durations = [];
let durationsHead = 0; // ring buffer yazma konumu

const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
let redisHits = 0;
let redisMisses = 0;

// Dış-API harcaması — günlük (Europe/Istanbul'a yakın UTC gün sınırı yeterli) sıfırlanır.
// S16-3 (Anthropic) ve S16-4 (Google) bu sayaçları besler.
let external = {};
let externalDay = currentDay();

// Event-loop gecikme histogramı (mümkünse) — tek sefer enable.
let eld = null;
if (monitorEventLoopDelay) {
  try { eld = monitorEventLoopDelay({ resolution: 20 }); eld.enable(); } catch { eld = null; }
}

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

function rollDayIfNeeded() {
  const d = currentDay();
  if (d !== externalDay) {
    external = {};
    externalDay = d;
  }
}

/** Bir isteğin süresini (ms) ve HTTP status'unu kaydeder (res 'finish'te çağrılır). */
function recordRequest(durationMs, statusCode) {
  if (durations.length < MAX_SAMPLES) {
    durations.push(durationMs);
  } else {
    durations[durationsHead] = durationMs;
    durationsHead = (durationsHead + 1) % MAX_SAMPLES;
  }
  const bucket = statusCode >= 500 ? '5xx' : statusCode >= 400 ? '4xx' : statusCode >= 300 ? '3xx' : '2xx';
  statusCounts[bucket] += 1;
}

/** Redis cache isabet/ıska sayacı (cacheGet'ten çağrılır). */
function recordRedis(hit) {
  if (hit) redisHits += 1; else redisMisses += 1;
}

/**
 * Dış-API çağrısı + (varsa) tahmini maliyet kaydı.
 * @param {string} provider 'anthropic' | 'google' ...
 * @param {number} costUsd  yaklaşık $ (yoksa 0)
 */
function recordExternalCall(provider, costUsd = 0) {
  rollDayIfNeeded();
  if (!external[provider]) external[provider] = { calls: 0, costUsd: 0 };
  external[provider].calls += 1;
  external[provider].costUsd += costUsd;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

/** Anlık metrik görüntüsü (saf — yan etkisiz). */
function snapshot() {
  rollDayIfNeeded();
  const sorted = [...durations].sort((a, b) => a - b);
  const total = statusCounts['2xx'] + statusCounts['3xx'] + statusCounts['4xx'] + statusCounts['5xx'];
  const errorRate = total ? statusCounts['5xx'] / total : 0;
  const redisTotal = redisHits + redisMisses;
  return {
    requests: {
      count: total,
      p50: Math.round(percentile(sorted, 0.50)),
      p95: Math.round(percentile(sorted, 0.95)),
      p99: Math.round(percentile(sorted, 0.99)),
      status: { ...statusCounts },
      errorRate: Number(errorRate.toFixed(4)),
    },
    redis: {
      hits: redisHits,
      misses: redisMisses,
      hitRate: redisTotal ? Number((redisHits / redisTotal).toFixed(4)) : null,
    },
    eventLoopLagMs: eld
      ? { mean: Number((eld.mean / 1e6).toFixed(2)), p95: Number((eld.percentile(95) / 1e6).toFixed(2)) }
      : null,
    external: { day: externalDay, ...external },
    uptimeSec: Math.floor(process.uptime()),
  };
}

/** Varsayılan alarm eşikleri (env ile ezilebilir). */
function thresholdsFromEnv() {
  return {
    errorRate: parseFloat(process.env.ALARM_ERROR_RATE || '0.02'),       // %2
    eventLoopLagMs: parseFloat(process.env.ALARM_EVENT_LOOP_LAG_MS || '200'),
    aiDailyUsd: parseFloat(process.env.ALARM_AI_DAILY_USD || '50'),
    googleDailyUsd: parseFloat(process.env.ALARM_GOOGLE_DAILY_USD || '30'),
  };
}

/**
 * Saf alarm değerlendirme — snapshot + eşiklerden ihlal listesi döner (yan etkisiz).
 * Yeterli örnek yokken (count düşük) latency/hata alarmı üretmez (gürültü önleme).
 */
function evaluateAlarms(snap, thresholds = thresholdsFromEnv()) {
  const breaches = [];
  if (snap.requests.count >= 50 && snap.requests.errorRate > thresholds.errorRate) {
    breaches.push({ metric: 'errorRate', value: snap.requests.errorRate, threshold: thresholds.errorRate });
  }
  if (snap.eventLoopLagMs && snap.eventLoopLagMs.p95 > thresholds.eventLoopLagMs) {
    breaches.push({ metric: 'eventLoopLagP95Ms', value: snap.eventLoopLagMs.p95, threshold: thresholds.eventLoopLagMs });
  }
  const ai = snap.external.anthropic;
  if (ai && ai.costUsd > thresholds.aiDailyUsd) {
    breaches.push({ metric: 'aiDailyUsd', value: Number(ai.costUsd.toFixed(2)), threshold: thresholds.aiDailyUsd });
  }
  const g = snap.external.google;
  if (g && g.costUsd > thresholds.googleDailyUsd) {
    breaches.push({ metric: 'googleDailyUsd', value: Number(g.costUsd.toFixed(2)), threshold: thresholds.googleDailyUsd });
  }
  return breaches;
}

/** Test yardımcısı — tüm sayaçları sıfırla. */
function _reset() {
  durations.length = 0;
  durationsHead = 0;
  statusCounts['2xx'] = statusCounts['3xx'] = statusCounts['4xx'] = statusCounts['5xx'] = 0;
  redisHits = 0;
  redisMisses = 0;
  external = {};
  externalDay = currentDay();
}

module.exports = {
  recordRequest,
  recordRedis,
  recordExternalCall,
  snapshot,
  evaluateAlarms,
  thresholdsFromEnv,
  _reset,
};
