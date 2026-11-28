'use strict';

/**
 * Web paneli çerez oturumu (ADR-001 #4, §5; issue #524 / #525).
 *
 * Model: tarayıcıdaki `__Host-eatlas_sid` çerezi 32 baytlık OPAK rastgele bir kimlik
 * taşır; DB'de (`web_sessions`) yalnızca o kimliğin HMAC'i durur. Mobilin 7 günlük JWT'sinin
 * aksine bu oturum sunucu tarafında İPTAL EDİLEBİLİR (çıkış, şifre sıfırlama, askıya alma).
 *
 * Süreler (restoran, Faz 1): 72 saat boşta / 14 gün mutlak. Boşta kalma sayacı
 * (`idleExpiresAt`) ve `lastSeenAt` her istekte DEĞİL, en çok 5 dakikada bir yazılır —
 * her panel isteğine bir UPDATE eklemek DB'ye gereksiz yazma yükü bindirirdi. Bedeli:
 * boşta kalma süresi ±5 dk hassasiyetle işler.
 *
 * S22-1: servis `req`/`res` almaz; HTTP çevirisi `middleware/webSession.js` ve
 * `controllers/webAuthController.js`'te.
 *
 * Zaman `Date.now()` üzerinden okunur → testler saati `jest.spyOn(Date, 'now')` ile ilerletir.
 */

const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { hashToken } = require('../utils/tokenHash');
const logger = require('../utils/logger');

const WEB_SESSION_COOKIE = '__Host-eatlas_sid';

// Faz 1'de web oturumu yalnızca restoran rolüne açılır. Faz 2 ADMIN'i 2FA ile ekler; o
// zamana kadar başka rolde bir oturum satırı (ör. rolü sonradan değişen hesap) geçersizdir.
const WEB_SESSION_ROLES = Object.freeze(['RESTAURANT']);

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_RAW_ID_LENGTH = 128; // base64url(32 bayt) = 43 karakter; çöp girdiyi DB'ye taşıma

function readPositiveNumber(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** @returns {{ idleMs: number, absoluteMs: number }} */
function getSessionDurations() {
  return {
    idleMs: readPositiveNumber('WEB_SESSION_IDLE_HOURS', 72) * HOUR_MS,
    absoluteMs: readPositiveNumber('WEB_SESSION_ABSOLUTE_DAYS', 14) * 24 * HOUR_MS,
  };
}

function now() {
  return new Date(Date.now());
}

/** Ham oturum kimliği → DB anahtarı. Alan ayrımı için önek: e-posta token hash'leriyle çakışmaz. */
function sessionKey(rawId) {
  return hashToken(`websid:${rawId}`);
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function isUsableRawId(rawId) {
  return typeof rawId === 'string' && rawId.length > 0 && rawId.length <= MAX_RAW_ID_LENGTH;
}

/**
 * Saf karar: oturum satırı `at` anında geçerli mi?
 * @returns {boolean}
 */
function isSessionLive(session, at) {
  if (!session || session.revokedAt) return false;
  const t = at.getTime();
  return t < new Date(session.idleExpiresAt).getTime()
    && t < new Date(session.absoluteExpiresAt).getTime();
}

/**
 * Yeni oturum açar. `previousRawId` verilirse (istekte gelen eski çerez) o satır silinir:
 * giriş HER ZAMAN yeni kimlik üretir, eski bir değer asla yeniden kullanılmaz (session
 * fixation koruması).
 *
 * @param {string} userId
 * @param {{ previousRawId?: string|null }} [opts]
 * @returns {Promise<{ rawId: string, csrfToken: string, maxAgeSeconds: number }>}
 */
async function createWebSession(userId, { previousRawId = null } = {}) {
  if (isUsableRawId(previousRawId)) {
    await prisma.webSession.deleteMany({ where: { id: sessionKey(previousRawId) } });
  }

  const { idleMs, absoluteMs } = getSessionDurations();
  const at = now();
  const rawId = randomToken();
  const csrfToken = randomToken();

  await prisma.webSession.create({
    data: {
      id: sessionKey(rawId),
      userId,
      csrfSecret: csrfToken,
      idleExpiresAt: new Date(at.getTime() + Math.min(idleMs, absoluteMs)),
      absoluteExpiresAt: new Date(at.getTime() + absoluteMs),
      lastSeenAt: at,
    },
  });

  return { rawId, csrfToken, maxAgeSeconds: Math.floor(absoluteMs / 1000) };
}

/**
 * Çerezdeki ham kimliği geçerli bir oturuma çözer.
 * Süresi dolmuş/iptal edilmiş satır görülürse silinir (tembel temizlik).
 *
 * @param {string|null} rawId
 * @returns {Promise<{ session: object, user: object } | null>}
 */
async function resolveWebSession(rawId) {
  if (!isUsableRawId(rawId)) return null;

  const id = sessionKey(rawId);
  const row = await prisma.webSession.findUnique({ where: { id }, include: { user: true } });
  if (!row) return null;

  const at = now();
  if (!isSessionLive(row, at) || !row.user || !WEB_SESSION_ROLES.includes(row.user.role)) {
    await prisma.webSession.deleteMany({ where: { id } }).catch(() => {});
    return null;
  }

  const { user, ...session } = row;

  if (at.getTime() - new Date(session.lastSeenAt).getTime() >= TOUCH_INTERVAL_MS) {
    const { idleMs } = getSessionDurations();
    const idleExpiresAt = new Date(Math.min(
      at.getTime() + idleMs,
      new Date(session.absoluteExpiresAt).getTime(),
    ));
    // Dokunma başarısız olsa bile istek geçerlidir — oturum zaten canlı.
    await prisma.webSession.update({ where: { id }, data: { lastSeenAt: at, idleExpiresAt } })
      .then(() => { session.lastSeenAt = at; session.idleExpiresAt = idleExpiresAt; })
      .catch(() => {});
  }

  return { session, user };
}

/** Tek oturumu siler (çıkış). */
async function revokeWebSession(rawId) {
  if (!isUsableRawId(rawId)) return 0;
  const { count } = await prisma.webSession.deleteMany({ where: { id: sessionKey(rawId) } });
  return count;
}

/**
 * Kullanıcının BÜTÜN web oturumlarını siler (çıkış-hepsi, şifre sıfırlama, askıya alma,
 * hesap silme). Mobil JWT'ler etkilenmez (ADR §8).
 *
 * Hata FIRLATMAZ: çağıran akış (ör. şifre sıfırlama) asıl işini tamamlamıştır ve bu adımın
 * düşmesi o işi geri almamalı. Hata loglanır ve `null` döner; askıya alınmış hesap zaten her
 * istekte `isSuspended` ile reddedildiği için orada gerçek bir açık oluşmaz.
 *
 * @param {string} userId
 * @param {string} reason log için
 * @returns {Promise<number|null>} silinen satır sayısı, hata durumunda null
 */
async function revokeAllWebSessions(userId, reason) {
  try {
    const { count } = await prisma.webSession.deleteMany({ where: { userId } });
    return count;
  } catch (err) {
    logger.error('[webSession] Oturumlar iptal edilemedi', { userId, reason, error: err.message });
    return null;
  }
}

/**
 * CSRF token karşılaştırması — sabit zamanlı. İki tarafın SHA-256 özeti karşılaştırılır:
 * `timingSafeEqual` eşit uzunluk ister ve uzunluk farkı da sızmamalı.
 */
function csrfTokenMatches(session, provided) {
  if (!session || typeof session.csrfSecret !== 'string' || typeof provided !== 'string' || !provided) {
    return false;
  }
  const a = crypto.createHash('sha256').update(session.csrfSecret).digest();
  const b = crypto.createHash('sha256').update(provided).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  WEB_SESSION_COOKIE,
  WEB_SESSION_ROLES,
  TOUCH_INTERVAL_MS,
  getSessionDurations,
  sessionKey,
  isSessionLive,
  createWebSession,
  resolveWebSession,
  revokeWebSession,
  revokeAllWebSessions,
  csrfTokenMatches,
};
