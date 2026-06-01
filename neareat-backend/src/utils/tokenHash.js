const crypto = require('crypto');

// E-posta doğrulama / şifre sıfırlama token'ları DB'de düz metin yerine HMAC-SHA256
// hash'i olarak saklanır. Böylece DB sızıntısında token'lar kullanılabilir olmaz.
// Kullanıcıya ham token gönderilir; doğrulamada gelen ham token hash'lenip karşılaştırılır.
const SECRET =
  process.env.TOKEN_HASH_SECRET || process.env.JWT_SECRET || 'neareat-token-hash-fallback';

/**
 * Bir token'ı HMAC-SHA256 ile hash'ler (64 karakterlik hex).
 * @param {string} token Ham token
 * @returns {string} Hex hash
 */
function hashToken(token) {
  return crypto.createHmac('sha256', SECRET).update(String(token)).digest('hex');
}

module.exports = { hashToken };
