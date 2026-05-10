function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  // 500 hatalarında production'da iç detay sızmasın
  const message = (isProduction && status >= 500)
    ? 'Sunucu hatası'
    : (err.message || 'Internal Server Error');
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
