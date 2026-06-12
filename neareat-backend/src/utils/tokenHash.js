const crypto = require('crypto');

// E-posta doğrulama / şifre sıfırlama token'ları DB'de düz metin yerine HMAC-SHA256
// hash'i olarak saklanır. Böylece DB sızıntısında token'lar kullanılabilir olmaz.
// Kullanıcıya ham token gönderilir; doğrulamada gelen ham token hash'lenip karşılaştırılır.
// Üretimde sabit/tahmin edilebilir bir fallback ASLA kullanılmaz (S12-2):
// aksi halde token'lar herkesçe bilinen bir sırla hash'lenip taklit edilebilirdi.
// validateEnv prod'da TOKEN_HASH_SECRET'i zorunlu kılar; burası ikinci savunma hattı.
function resolveSecret() {
  const explicit = process.env.TOKEN_HASH_SECRET || process.env.JWT_SECRET;
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL] TOKEN_HASH_SECRET/JWT_SECRET tanımlı değil — token hash güvenliği sağlanamaz');
  }
  return 'neareat-token-hash-fallback'; // yalnızca geliştirme/test
}

const SECRET = resolveSecret();

/**
 * Bir token'ı HMAC-SHA256 ile hash'ler (64 karakterlik hex).
 * @param {string} token Ham token
 * @returns {string} Hex hash
 */
function hashToken(token) {
  return crypto.createHmac('sha256', SECRET).update(String(token)).digest('hex');
}

module.exports = { hashToken };
