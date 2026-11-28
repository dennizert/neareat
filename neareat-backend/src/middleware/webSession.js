'use strict';

/**
 * Web paneli çerez oturumu middleware'leri (issue #524 / #525).
 *
 * CSRF iki katmanlıdır (ADR-001 #5):
 *  1. Oturuma bağlı token: `X-CSRF-Token` başlığı oturumun token'ıyla sabit zamanlı eşleşmeli.
 *  2. Origin: `Origin` başlığı `PUBLIC_WEB_ORIGIN`'e birebir eşit olmalı (yoksa da red).
 * Yalnızca ÇEREZLE kimliği doğrulanan ve durum değiştiren (POST/PUT/PATCH/DELETE) isteklere
 * uygulanır. Bearer istekleri (mobil) bu dosyaya hiç girmez — `middleware/auth.js` Bearer'ı
 * önce dener ve bulursa çerez dalına inmez.
 */

const { getPublicWebOrigin } = require('../config/webOrigin');
const { readCookie, serializeSessionCookie } = require('../utils/cookies');
const {
  WEB_SESSION_COOKIE, resolveWebSession, revokeAllWebSessions, csrfTokenMatches,
} = require('../services/webSessionService');
const { logSecurityEvent, EVENTS } = require('./securityLogger');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ERRORS = Object.freeze({
  SESSION_INVALID: { error: 'Oturumunuzun süresi doldu, lütfen tekrar giriş yapın.', code: 'WEB_SESSION_INVALID' },
  ORIGIN_INVALID: { error: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.', code: 'ORIGIN_INVALID' },
  CSRF_INVALID: { error: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.', code: 'CSRF_INVALID' },
  SUSPENDED: { error: 'Hesabınız askıya alınmıştır.' },
});

function getSessionCookie(req) {
  return readCookie(req.headers.cookie, WEB_SESSION_COOKIE);
}

function hasSessionCookie(req) {
  return getSessionCookie(req) !== null;
}

function isSafeMethod(method) {
  return SAFE_METHODS.has(String(method).toUpperCase());
}

/** Saf karar: istek Origin'i panel origin'iyle eşleşiyor mu? Env yoksa fail-closed. */
function originMatches(req) {
  const expected = getPublicWebOrigin();
  const origin = req.headers.origin;
  return !!expected && typeof origin === 'string' && origin === expected;
}

function reject(req, res, reason, body) {
  logSecurityEvent(EVENTS.WEB_CSRF_REJECTED, {
    ip: req.ip, path: req.path, method: req.method, requestId: req.id, reason,
  });
  return res.status(403).json(body);
}

/**
 * Oturum ÖNCESİ uçlar (web/login, web/google): CSRF token'ı yoktur ama Origin kontrolü
 * vardır — aksi halde başka bir site kullanıcının tarayıcısına bizim adımıza giriş
 * yaptırıp (login CSRF) kendi hesabına bağlayabilir.
 */
function requireWebOrigin(req, res, next) {
  if (!originMatches(req)) return reject(req, res, 'origin_mismatch', ERRORS.ORIGIN_INVALID);
  next();
}

/**
 * Çerezle doğrulanmış oturum için yazma korumaları. Geçerse null, geçmezse yanıtı yazıp
 * döner (çağıran `return` eder).
 */
function enforceWriteGuards(req, res, session) {
  if (isSafeMethod(req.method)) return null;
  if (!originMatches(req)) return reject(req, res, 'origin_mismatch', ERRORS.ORIGIN_INVALID);
  if (!csrfTokenMatches(session, req.headers['x-csrf-token'])) {
    return reject(req, res, 'csrf_mismatch', ERRORS.CSRF_INVALID);
  }
  return null;
}

/**
 * Çerezden kimlik doğrulama çekirdeği — `authenticate` (Bearer yoksa) ve
 * `requireWebSession` paylaşır. Başarıda `req.user` Bearer yolundakiyle AYNI şekildedir
 * (tam Prisma user kaydı); ek olarak `req.webSession` ve `req.authMethod = 'cookie'`.
 */
async function authenticateWithCookie(req, res, next) {
  const rawId = getSessionCookie(req);
  let resolved;
  try {
    resolved = await resolveWebSession(rawId);
  } catch (err) {
    return next(err);
  }

  if (!resolved) {
    logSecurityEvent(EVENTS.AUTH_FAILED, {
      ip: req.ip, path: req.path, requestId: req.id, reason: 'invalid_web_session',
    });
    // Geçersiz çerez HttpOnly olduğu için istemci silemez → sunucu temizler.
    res.set('Set-Cookie', serializeSessionCookie(WEB_SESSION_COOKIE, '', { maxAgeSeconds: 0 }));
    return res.status(401).json(ERRORS.SESSION_INVALID);
  }

  const { user, session } = resolved;
  if (user.isSuspended) {
    logSecurityEvent(EVENTS.SUSPENDED_ACCESS, {
      userId: user.id, ip: req.ip, path: req.path, requestId: req.id,
    });
    await revokeAllWebSessions(user.id, 'suspended_access');
    return res.status(403).json(ERRORS.SUSPENDED);
  }

  if (enforceWriteGuards(req, res, session)) return undefined;

  req.user = user;
  req.webSession = session;
  req.authMethod = 'cookie';
  next();
}

/** Yalnızca çerez oturumu kabul eden uçlar (web/session, web/logout-all). */
function requireWebSession(req, res, next) {
  if (!hasSessionCookie(req)) return res.status(401).json(ERRORS.SESSION_INVALID);
  return authenticateWithCookie(req, res, next);
}

module.exports = {
  ERRORS,
  getSessionCookie,
  hasSessionCookie,
  isSafeMethod,
  originMatches,
  requireWebOrigin,
  enforceWriteGuards,
  authenticateWithCookie,
  requireWebSession,
};
