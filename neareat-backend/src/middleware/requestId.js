const { v4: uuidv4 } = require('uuid');

// Her isteğe izlenebilir bir kimlik ekler.
// Client X-Request-ID gönderirse onu kullanır (log korelasyonu için).
module.exports = function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && incoming.length <= 64)
    ? incoming
    : uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};
