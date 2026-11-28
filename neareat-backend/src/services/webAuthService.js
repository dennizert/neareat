'use strict';

/**
 * Web paneli girişi (issue #524). S22-1: `req`/`res` almaz; beklenen iş hataları
 * `HttpError` ile bildirilir, gövde controller'da aynen yazılır.
 *
 * Kurallar (FAZ1-ANALIZ §4-1, §8):
 *  - Yalnızca RESTAURANT rolü oturum açar. USER/ADMIN yanıtı yanlış şifreyle AYNI statü ve
 *    gövdedir → yanıt hesabın varlığını ya da rolünü sızdırmaz.
 *  - Askıya alınmış hesap (doğru kimlik bilgisiyle) mevcut askı mesajını alır.
 *  - Web Google girişi HİÇBİR KOŞULDA hesap oluşturmaz (mobil `POST /auth/login`
 *    eşleşmeyen e-postada USER yaratır; web'de bu yol kapalı — V1).
 *  - Her başarılı giriş yeni oturum kimliği üretir; istekte gelen eski çerez silinir.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { verifyGoogleIdToken } = require('./googleAuth');
const { linkGoogleToExistingAccount } = require('./googleAccountLink');
const { createWebSession, WEB_SESSION_ROLES } = require('./webSessionService');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');

// authController.loginEmail ile aynı timing-safe dummy hash: kullanıcı yokken de bcrypt
// süresi harcanır → yanıt süresinden hesabın varlığı anlaşılamaz.
const DUMMY_HASH = '$2a$10$X/KGqsN7fZa.LFpuN8VqreONKkfOX.jZTqf4RBm7J6FS2EeL9Ge8G';

// Mesaj `login/email` ile birebir (web istemcisi aynı metni gösterir).
const INVALID_CREDENTIALS = Object.freeze({ error: 'E-posta veya şifre hatalı' });
const GOOGLE_REJECTED = Object.freeze({ error: 'Bu Google hesabıyla restoran paneline giriş yapılamıyor.' });
const GOOGLE_INVALID = Object.freeze({ error: 'Google ile giriş doğrulanamadı. Lütfen tekrar deneyin.' });
const SUSPENDED = Object.freeze({ error: 'Hesabınız askıya alınmıştır.' });

function canOpenWebSession(user) {
  return !!user && WEB_SESSION_ROLES.includes(user.role);
}

function logFailure(ctx, reason) {
  logSecurityEvent(EVENTS.AUTH_FAILED, { ip: ctx.ip, path: ctx.path, requestId: ctx.requestId, reason });
}

/**
 * @param {{ email: string, password: string }} credentials (email trim+lowercase gelmiş)
 * @param {{ previousRawId?: string|null, ip?: string, path?: string, requestId?: string }} ctx
 * @returns {Promise<{ user: object, rawId: string, maxAgeSeconds: number }>}
 */
async function loginWithPassword({ email, password }, ctx = {}) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.passwordHash || !valid || !canOpenWebSession(user)) {
    logFailure(ctx, 'web_login_failed');
    throw new HttpError(401, INVALID_CREDENTIALS);
  }
  if (user.isSuspended) {
    logSecurityEvent(EVENTS.SUSPENDED_ACCESS, { userId: user.id, ip: ctx.ip, path: ctx.path, requestId: ctx.requestId });
    throw new HttpError(403, SUSPENDED);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createWebSession(user.id, { previousRawId: ctx.previousRawId });
  return { user, ...session };
}

/**
 * @param {{ credential: string }} input GIS ID token
 * @param {{ previousRawId?: string|null, ip?: string, path?: string, requestId?: string }} ctx
 */
async function loginWithGoogle({ credential }, ctx = {}) {
  let decoded;
  try {
    decoded = await verifyGoogleIdToken(credential);
  } catch {
    logFailure(ctx, 'web_google_invalid_token');
    throw new HttpError(401, GOOGLE_INVALID);
  }

  // E-postayla eşleştirme yapılabilmesi için Google'ın e-postayı doğrulamış olması şart
  // (authController.login ile aynı gerekçe).
  if (!decoded?.sub || !decoded.email || decoded.email_verified === false) {
    logFailure(ctx, 'web_google_unverified_email');
    throw new HttpError(401, GOOGLE_REJECTED);
  }

  let user = await prisma.user.findUnique({ where: { googleId: decoded.sub } });
  let linked = false;
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: decoded.email } });
    // Rol, HERHANGİ bir yazmadan ÖNCE denetlenir: USER/ADMIN hesabına web'den Google
    // kimliği bağlanmaz. Eşleşme yoksa da kayıt OLUŞTURULMAZ.
    if (!canOpenWebSession(byEmail)) {
      logFailure(ctx, 'web_google_no_restaurant_account');
      throw new HttpError(401, GOOGLE_REJECTED);
    }
    // Askıdaki hesaba Google kimliği de bağlanmaz.
    if (byEmail.isSuspended) {
      logSecurityEvent(EVENTS.SUSPENDED_ACCESS, { userId: byEmail.id, ip: ctx.ip, path: ctx.path, requestId: ctx.requestId });
      throw new HttpError(403, SUSPENDED);
    }
    user = await linkGoogleToExistingAccount(byEmail, decoded, ctx);
    linked = true;
  }

  if (!canOpenWebSession(user)) {
    logFailure(ctx, 'web_google_no_restaurant_account');
    throw new HttpError(401, GOOGLE_REJECTED);
  }
  if (user.isSuspended) {
    logSecurityEvent(EVENTS.SUSPENDED_ACCESS, { userId: user.id, ip: ctx.ip, path: ctx.path, requestId: ctx.requestId });
    throw new HttpError(403, SUSPENDED);
  }

  if (!linked) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  }
  const session = await createWebSession(user.id, { previousRawId: ctx.previousRawId });
  return { user, ...session };
}

module.exports = {
  loginWithPassword,
  loginWithGoogle,
  INVALID_CREDENTIALS,
  GOOGLE_REJECTED,
  GOOGLE_INVALID,
};
