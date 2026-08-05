'use strict';

/**
 * Dış çağrı zaman aşımı yardımcıları (S20-1).
 *
 * Makale §7.1: her HTTP/DB/kuyruk çağrısının makul bir zaman aşımı olmalı. Zaman
 * aşımı olmayan bir çağrı, upstream yanıt vermediğinde soketi süresiz açık tutar;
 * yeterince birikirse istek havuzu tükenir ve servis yeni istek kabul edemez.
 *
 * Zaman aşımı hataları AYIRT EDİLEBİLİR olmalı: S20-2'nin yeniden deneme (retry)
 * kararı buna dayanacak. Hem `err instanceof TimeoutError` hem de
 * `err.code === 'ETIMEDOUT'` ile tanınabilir (ikincisi Node'un ağ hatalarıyla aynı
 * kod — çağıran taraf tek bir kontrolle her ikisini kapsayabilir).
 */

class TimeoutError extends Error {
  constructor(timeoutMs, label = 'İstek') {
    super(`${label} ${timeoutMs}ms içinde yanıt vermedi (zaman aşımı).`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEDOUT';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Zaman aşımı süresini env'den okur. Geçersiz/eksik değer sessizce varsayılana
 * düşer — hatalı bir env değeri servisi zaman aşımsız (yani korumasız) bırakmamalı.
 *
 * @param {string} name env değişkeni adı
 * @param {number} fallbackMs geçersizse kullanılacak varsayılan (ms)
 * @returns {number} pozitif tamsayı ms
 */
function readTimeoutEnv(name, fallbackMs) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

/**
 * Kendi zaman aşımı seçeneği olmayan promise tabanlı SDK çağrılarını (ör. Resend)
 * süre sınırına bağlar.
 *
 * ÖNEMLİ sınır: yarışı kaybeden çağrı arka planda devam eder — bu sarmalayıcı
 * uzaktaki işi iptal etmez, yalnızca ÇAĞIRANI serbest bırakır. İptal edilebilirlik
 * gerekiyorsa SDK'nın kendi `AbortSignal` desteği kullanılmalıdır.
 *
 * @param {Promise<T>} promise sarmalanacak çağrı
 * @param {number} timeoutMs süre sınırı; 0/geçersiz ise sarmalama yapılmaz
 * @param {string} label hata mesajında görünecek etiket
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, timeoutMs, label) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.resolve(promise);

  let timer = null;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(timeoutMs, label)), timeoutMs);
    // Bekleyen bir zamanlayıcı süreç kapanışını geciktirmesin.
    if (typeof timer.unref === 'function') timer.unref();
  });

  // race iki tarafa da handler bağlar; kaybeden reddederse "unhandled rejection"
  // oluşmaz, sonuç yalnızca yok sayılır.
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

module.exports = { TimeoutError, withTimeout, readTimeoutEnv };
