const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('[FATAL] JWT_SECRET env var is not set — sunucu başlatılmıyor');
  process.exit(1);
}

// Rotasyon desteği: imzalama HER ZAMAN güncel secret ile yapılır, doğrulama ise önce
// güncel sonra (tanımlıysa) ÖNCEKİ secret ile denenir. Böylece secret değiştirildiğinde
// sahadaki geçerli oturumlar düşmez — eski token'lar kendi süreleri dolana kadar çalışır.
//
// Rotasyon yordamı:
//   1. JWT_PREVIOUS_SECRET = (mevcut JWT_SECRET), JWT_SECRET = (yeni rastgele değer)
//   2. Deploy → yeni girişler yeni secret ile imzalanır, eski token'lar hâlâ geçerli
//   3. Token ömrü (7 gün) geçtikten sonra JWT_PREVIOUS_SECRET kaldırılır
const PREVIOUS_SECRET = process.env.JWT_PREVIOUS_SECRET || null;

const ALGORITHM = 'HS256';

// Kullanıcı için 7 günlük oturum JWT'si üretir (sub = userId). Email/şifre, Google ve
// admin giriş akışlarının hepsi aynı token tipini üretir → tek doğrulama yolu.
function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d', algorithm: ALGORITHM });
}

// Token'ı doğrular. Algoritma sabitlenir (yalnızca HS256) — saldırganın `alg` ile
// algoritma karıştırma (algorithm confusion) saldırısı yapmasını engellemek için.
// Güncel secret başarısız olursa önceki secret denenir (bkz. rotasyon notu).
// İkisi de başarısızsa GÜNCEL secret'ın hatası fırlatılır — çağıranlar (auth middleware)
// hata tipine göre davranmıyor, ama en alakalı hata korunmuş olur.
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
  } catch (err) {
    if (!PREVIOUS_SECRET) throw err;
    try {
      return jwt.verify(token, PREVIOUS_SECRET, { algorithms: [ALGORITHM] });
    } catch {
      throw err;
    }
  }
}

module.exports = { signToken, verifyToken };
