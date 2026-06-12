// Merkezi Express hata yakalayıcı (en son middleware). Tüm controller'lar hataları
// next(err) ile buraya iletir → tutarlı JSON hata formatı + requestId ile izlenebilirlik.
// Üretimde 5xx detayları gizlenir (bilgi sızıntısını önlemek için "Sunucu hatası" döner),
// 5xx'ler stack ile loglanır.
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (isProduction && status >= 500)
    ? 'Sunucu hatası'
    : (err.message || 'Internal Server Error');

  if (status >= 500) {
    console.error(`[ERROR] requestId=${req.id} status=${status}`, err);
  }

  res.status(status).json({ error: message, requestId: req.id });
}

module.exports = errorHandler;
