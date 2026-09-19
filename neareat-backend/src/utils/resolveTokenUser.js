'use strict';

/**
 * Bearer token → kullanıcı çözümü. `auth` ve `optionalAuth` middleware'lerinin ORTAK
 * çekirdeği.
 *
 * Neden ortak: iki middleware aynı işi iki ayrı kopyayla yapıyordu ve kopyalar
 * birbirinden ayrılmıştı. `auth` Google OAuth idToken'ını `verifyGoogleIdToken` +
 * `googleId: decoded.sub` ile çözerken, `optionalAuth` FIREBASE token'ı bekliyordu
 * (`getAuth().verifyIdToken` + `googleId: decoded.uid`). Mobil, Google ile giren
 * kullanıcılar için her istekte HAM Google idToken'ı gönderdiğinden (services/auth.ts
 * → `setTokenGetter(getGoogleIdToken)`), optionalAuth bu kullanıcıları hiç tanıyamıyor
 * ve sessizce anonim sayıyordu.
 *
 * Bu fonksiyon kimlik doğrulama SONUCUNU döndürür; HTTP yanıtı/loglama kararını
 * çağıran middleware verir (ikisinin davranışı kasıtlı olarak farklı).
 *
 * @returns {Promise<{user: object|null, outcome: 'jwt'|'google'|'google_user_not_found'|'invalid_token'}>}
 */

const { verifyGoogleIdToken } = require('../services/googleAuth');
const { verifyToken } = require('../utils/jwt');
const prisma = require('./prisma');

async function resolveTokenUser(token) {
  // 1) Önce custom JWT (email/şifre + admin + restoran girişleri aynı tipi üretir).
  try {
    const decoded = verifyToken(token);
    if (decoded?.sub) {
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      // Kullanıcı bulunamazsa Google yoluna DÜŞÜLÜR (mevcut davranış korunuyor).
      if (user) return { user, outcome: 'jwt' };
    }
  } catch {
    // JWT değil ya da geçersiz — Google'ı dene.
  }

  // 2) Google OAuth idToken.
  try {
    const decoded = await verifyGoogleIdToken(token);
    const user = await prisma.user.findUnique({ where: { googleId: decoded.sub } });
    if (!user) return { user: null, outcome: 'google_user_not_found' };
    return { user, outcome: 'google' };
  } catch {
    return { user: null, outcome: 'invalid_token' };
  }
}

module.exports = { resolveTokenUser };
