'use strict';

/**
 * İstek bağlamı (S21-2).
 *
 * `AsyncLocalStorage`, bir isteğin kimliğini çağrı zincirinin tamamına taşır. Alternatif
 * her servis fonksiyonunun imzasına `req` (ya da `requestId`) eklemekti — bu, log
 * korelasyonu için tüm servis katmanını değiştirmek anlamına gelirdi.
 *
 * TASARIM KARARI — bağlam kaybı HATA DEĞİL, ZARİF DÜŞÜŞTÜR. ALS bağlamı bazı async
 * sınırlarda (dışarıda oluşturulmuş event emitter'lar, bazı native callback'ler) kaybolur.
 * Böyle bir durumda `getRequestId()` `null` döner ve log satırı korelasyon kimliği olmadan
 * yine yazılır. Bir logun kaybolması, korelasyon kimliğinin kaybolmasından kötüdür.
 */

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

/**
 * `fn`'i verilen bağlam altında çalıştırır. `fn` içinde başlatılan tüm async iş
 * (await zincirleri, promise'ler, setTimeout) bu bağlamı devralır.
 *
 * @param {{ requestId?: string, job?: string }} context
 * @param {Function} fn
 */
function runWithContext(context, fn) {
  return storage.run(context, fn);
}

/**
 * Cron/job çalıştırmalarını etiketler — istek bağlamı olmayan işler `job:<ad>` ile
 * loglanır, böylece rutin loglar arasında kaynağı belli olur.
 *
 * @param {string} jobName
 * @param {Function} fn
 */
function runWithJobContext(jobName, fn) {
  return storage.run({ job: jobName }, fn);
}

/** Aktif bağlam ya da bağlam yoksa `null`. */
function getContext() {
  return storage.getStore() || null;
}

/** Aktif isteğin kimliği; istek bağlamı yoksa `null`. */
function getRequestId() {
  const store = storage.getStore();
  return store && store.requestId ? store.requestId : null;
}

/** Aktif job adı; job bağlamı yoksa `null`. */
function getJobName() {
  const store = storage.getStore();
  return store && store.job ? store.job : null;
}

module.exports = {
  runWithContext,
  runWithJobContext,
  getContext,
  getRequestId,
  getJobName,
};
