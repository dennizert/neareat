// Merkezi Express hata yakalayıcı (en son middleware). Tüm controller'lar hataları
// next(err) ile buraya iletir → tutarlı JSON hata formatı + requestId ile izlenebilirlik.
// Üretimde 5xx detayları gizlenir (bilgi sızıntısını önlemek için "Sunucu hatası" döner),
// 5xx'ler stack ile loglanır ve (S14-B3) Sentry'ye gönderilir.
const { captureException } = require('../services/sentry');
const logger = require('../utils/logger'); // S21-2

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (isProduction && status >= 500)
    ? 'Sunucu hatası'
    : (err.message || 'Internal Server Error');

  if (status >= 500) {
    // S21-2 — requestId artık logger tarafından bağlamdan otomatik eklenir; yine de
    // açıkça geçiyoruz: ALS bağlamının kaybolduğu bir kenar durumda bile hata logunun
    // korelasyon kimliğini taşıması gerekir (hata logu, kimliği en çok gereken yerdir).
    logger.error('[ERROR] İstek başarısız', {
      requestId: req.id,
      status,
      path: req.path,
      error: err.message,
      stack: err.stack,
    });
    captureException(err, { requestId: req.id, path: req.path, status }); // DSN yoksa no-op
  }

  res.status(status).json({ error: message, requestId: req.id });
}

module.exports = errorHandler;
