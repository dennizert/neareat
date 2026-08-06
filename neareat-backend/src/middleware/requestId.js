const { v4: uuidv4 } = require('uuid');
const { runWithContext } = require('../utils/requestContext'); // S21-2

// Her isteğe izlenebilir bir kimlik ekler.
// Client X-Request-ID gönderirse onu kullanır (log korelasyonu için).
//
// S21-2 — `next()` bağlam İÇİNDE çağrılır: sonraki tüm middleware'ler, controller'lar ve
// onların başlattığı async iş bu bağlamı devralır, böylece servis imzalarına `req`
// eklemeden `logger` satırlara requestId işleyebilir.
module.exports = function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && incoming.length <= 64)
    ? incoming
    : uuidv4();
  res.setHeader('X-Request-ID', req.id);
  runWithContext({ requestId: req.id }, () => next());
};
