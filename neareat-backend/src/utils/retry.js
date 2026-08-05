'use strict';

/**
 * Yeniden deneme (retry) çekirdeği — saf ve enjekte edilebilir (S20-2).
 *
 * Makale §7.2: geçici hatalar üst sınırlı, exponential backoff + jitter ile yeniden
 * denenmeli. Buradaki çekirdek KASITLI olarak hiçbir şeyin "geçici" olduğunu kendisi
 * karar vermez — sınıflandırma `isRetryable` ile dışarıdan verilir. Varsayılan
 * `isRetryable` hiçbir şeyi yeniden denemez: yanlışlıkla yan etkili bir çağrının
 * tekrarlanması, hiç retry olmamasından daha tehlikelidir.
 *
 * `sleep` ve `random` enjekte edilebilir → testler gerçek zaman beklemez ve backoff
 * deterministik doğrulanabilir.
 */

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 2000;

/** Bekleyen zamanlayıcı süreç kapanışını geciktirmesin. */
function realSleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
}

/**
 * "Full jitter" backoff: [0, min(max, base * 2^attempt)] aralığından rastgele.
 *
 * Düz exponential backoff, aynı anda hata alan tüm istemcileri aynı anda yeniden
 * denemeye yollar (thundering herd) — jitter bunu zamana yayar.
 *
 * @param {number} attempt 0 tabanlı deneme indeksi
 * @returns {number} beklenecek ms
 */
function computeBackoffMs(attempt, { baseDelayMs, maxDelayMs, random }) {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  return Math.floor(random() * ceiling);
}

/**
 * `fn`'i başarılı olana kadar, üst sınıra kadar yeniden dener.
 *
 * @param {() => Promise<T>} fn çalıştırılacak iş (idempotent OLMALI)
 * @param {object} [opts]
 * @param {number} [opts.retries=2] yeniden deneme sayısı (toplam çağrı = retries + 1)
 * @param {(err: Error) => boolean} [opts.isRetryable] hangi hata yeniden denenir
 * @param {(ms: number) => Promise<void>} [opts.sleep] bekleme (test için enjekte edilir)
 * @returns {Promise<T>}
 * @template T
 */
async function withRetry(fn, opts = {}) {
  const {
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    isRetryable = () => false,
    sleep = realSleep,
    random = Math.random,
  } = opts;

  const maxAttempts = Math.max(0, retries) + 1;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const isLastAttempt = attempt >= maxAttempts - 1;
      // Son deneme ya da kalıcı hata → maskeleme, olduğu gibi yukarı fırlat.
      if (isLastAttempt || !isRetryable(err)) throw err;
      await sleep(computeBackoffMs(attempt, { baseDelayMs, maxDelayMs, random }));
    }
  }
}

/**
 * Geçici ağ/soket hatası mı? (DNS, bağlantı sıfırlama, zaman aşımı…)
 *
 * S20-1'in `TimeoutError`'ı da `code:'ETIMEDOUT'` taşıdığı için buraya dahildir.
 */
const TRANSIENT_NETWORK_CODES = Object.freeze([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function isTransientNetworkError(err) {
  return Boolean(err && TRANSIENT_NETWORK_CODES.includes(err.code));
}

module.exports = {
  withRetry,
  computeBackoffMs,
  isTransientNetworkError,
  TRANSIENT_NETWORK_CODES,
  DEFAULT_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
};
