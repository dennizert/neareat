const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('[FATAL] JWT_SECRET env var is not set — sunucu başlatılmıyor');
  process.exit(1);
}

const ALGORITHM = 'HS256';

// Kullanıcı için 7 günlük oturum JWT'si üretir (sub = userId). Email/şifre, Google ve
// admin giriş akışlarının hepsi aynı token tipini üretir → tek doğrulama yolu.
function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d', algorithm: ALGORITHM });
}

// Token'ı doğrular. Algoritma sabitlenir (yalnızca HS256) — saldırganın `alg` ile
// algoritma karıştırma (algorithm confusion) saldırısı yapmasını engellemek için.
function verifyToken(token) {
  return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
