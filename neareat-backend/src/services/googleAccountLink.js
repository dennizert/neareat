'use strict';

/**
 * Google kimliğini aynı e-postalı MEVCUT bir hesaba bağlama kuralı (account linking).
 *
 * Mobil `POST /api/auth/login` ile web `POST /api/auth/web/google` aynı kuralı kullanır
 * (ADR-001 §3: "hesap bağlama kuralı authController.login ile ortak servisten") — iki
 * kopya zamanla ayrışırsa hesap devralma önlemi bir yolda sessizce delinir.
 *
 * ÖN-KAYITLA HESAP DEVRALMA ÖNLEMİ.
 * Senaryo: saldırgan victim@x.com ile email/şifre hesabı açar (kayıt e-posta doğrulaması
 * zorunlu değil), kurban daha sonra Google ile girer, kimliği saldırganın hesabına bağlanır —
 * ve saldırgan bildiği şifreyle kurbanın hesabına girmeye DEVAM eder.
 *
 * Kural: e-posta sahipliğini KANITLAYAN taraf kazanır.
 *  - Hesabın e-postası doğrulanmışsa: sahiplik zaten kanıtlanmış → normal bağla.
 *  - Doğrulanmamışsa: o hesap sahipliği hiç kanıtlamadı, Google şimdi kanıtladı →
 *    bağla, doğrulanmış işaretle ve KANITLANMAMIŞ şifre kimliğini iptal et.
 *    (Meşru kullanıcı "şifremi unuttum" ile yeniden belirleyebilir; o akış da
 *    e-posta sahipliği ister, yani güvenli.)
 *
 * Çağıran, `decoded.email_verified !== false` olduğunu ÖNCEDEN doğrulamış olmalıdır.
 */

const prisma = require('../utils/prisma');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');

/**
 * @param {object} existingByEmail aynı e-postalı mevcut user kaydı
 * @param {object} decoded doğrulanmış Google idToken payload'u
 * @param {{ ip?: string, path?: string, requestId?: string }} ctx güvenlik logu için
 * @returns {Promise<object>} güncellenmiş user
 */
async function linkGoogleToExistingAccount(existingByEmail, decoded, ctx = {}) {
  const revokePassword = !existingByEmail.emailVerified && !!existingByEmail.passwordHash;

  const user = await prisma.user.update({
    where: { id: existingByEmail.id },
    data: {
      googleId: decoded.sub,
      photoUrl: existingByEmail.photoUrl || decoded.picture || null,
      lastLoginAt: new Date(),
      emailVerified: true, // Google e-posta sahipliğini doğruladı
      ...(revokePassword ? { passwordHash: null, authProvider: 'google' } : {}),
    },
  });

  if (revokePassword) {
    logSecurityEvent(EVENTS.ACCOUNT_LINK_PASSWORD_REVOKED, {
      userId: user.id,
      ip: ctx.ip,
      path: ctx.path,
      requestId: ctx.requestId,
      reason: 'unverified_password_account_claimed_by_google',
    });
  }

  return user;
}

module.exports = { linkGoogleToExistingAccount };
