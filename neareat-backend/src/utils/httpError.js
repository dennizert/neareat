'use strict';

/**
 * Servis katmanı → HTTP hata köprüsü (S22-1).
 *
 * Controller'ları inceltirken çözülmesi gereken sorun şu: iş kuralı servise taşınıyor,
 * ama "hangi HTTP durumu ve hangi gövde" bilgisi HTTP katmanına ait. `HttpError` bu ikisini
 * birbirine bağlar — servis *beklenen* bir iş hatasını bildirir, controller onu HTTP'ye çevirir.
 *
 * Gövde SERBEST BIRAKILDI (`{ error }` şablonuna zorlanmadı): mevcut uçlar `code`
 * (`SUBSCRIPTION_REQUIRED`, `LEVEL_REQUIRED`), `message`, `warning` gibi alanlar döndürüyor ve
 * mobil bunlara bakıyor. Refactor sırasında gövdelerin BİREBİR korunması, tek tip bir hata
 * şablonu dayatmaktan daha değerli.
 *
 * Beklenmeyen hatalar (programlama hataları, DB çökmesi) HttpError DEĞİLDİR; `next(err)` ile
 * merkezi `errorHandler`'a gider, 5xx olarak loglanır ve Sentry'ye iletilir.
 */

class HttpError extends Error {
  /**
   * @param {number} status HTTP durum kodu
   * @param {object|string} body istemciye dönecek gövde (string verilirse `{ error }` olur)
   */
  constructor(status, body) {
    const normalized = typeof body === 'string' ? { error: body } : (body || {});
    super(normalized.error || normalized.message || `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = normalized;
  }
}

/**
 * Controller `catch` bloklarının ortak kuyruğu.
 *
 * Beklenen iş hatası → gövdesi AYNEN yazılır (durum kodu + alanlar korunur).
 * Beklenmeyen hata → `next(err)`; merkezi errorHandler 5xx olarak ele alır.
 *
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {Function} next
 */
function sendHttpError(res, err, next) {
  if (err instanceof HttpError) return res.status(err.status).json(err.body);
  return next(err);
}

module.exports = { HttpError, sendHttpError };
