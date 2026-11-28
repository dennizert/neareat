'use strict';

/**
 * /api/auth/web — web paneli giriş/oturum/çıkış (issue #524). S22-1: yalnızca HTTP çevirisi;
 * iş kuralı `services/webAuthService.js` ve `services/webSessionService.js`'te.
 */

const { sendHttpError } = require('../utils/httpError');
const { sanitizeUser } = require('../utils/userDto');
const { serializeSessionCookie } = require('../utils/cookies');
const { logRequest } = require('../services/logService');
const { loginWithPassword, loginWithGoogle } = require('../services/webAuthService');
const {
  WEB_SESSION_COOKIE, resolveWebSession, revokeWebSession, revokeAllWebSessions,
} = require('../services/webSessionService');
const { getSessionCookie, enforceWriteGuards } = require('../middleware/webSession');

function setSessionCookie(res, rawId, maxAgeSeconds) {
  res.set('Set-Cookie', serializeSessionCookie(WEB_SESSION_COOKIE, rawId, { maxAgeSeconds }));
}

function clearSessionCookie(res) {
  res.set('Set-Cookie', serializeSessionCookie(WEB_SESSION_COOKIE, '', { maxAgeSeconds: 0 }));
}

function context(req) {
  return { previousRawId: getSessionCookie(req), ip: req.ip, path: req.path, requestId: req.id };
}

function respondLoggedIn(req, res, { user, rawId, maxAgeSeconds }, action) {
  setSessionCookie(res, rawId, maxAgeSeconds);
  res.set('Cache-Control', 'no-store');
  logRequest({ req: { ...req, user }, page: 'Web Giriş', action }).catch(() => {});
  res.status(204).end();
}

// POST /api/auth/web/login { email, password } → 204 + Set-Cookie
async function webLogin(req, res, next) {
  try {
    const result = await loginWithPassword(req.body, context(req));
    respondLoggedIn(req, res, result, 'Web panele e-posta ile giriş yaptı');
  } catch (err) {
    sendHttpError(res, err, next);
  }
}

// POST /api/auth/web/google { credential } → 204 + Set-Cookie
async function webGoogleLogin(req, res, next) {
  try {
    const result = await loginWithGoogle(req.body, context(req));
    respondLoggedIn(req, res, result, 'Web panele Google ile giriş yaptı');
  } catch (err) {
    sendHttpError(res, err, next);
  }
}

// GET /api/auth/web/session → { user, csrfToken, mfa }
function getWebSession(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ user: sanitizeUser(req.user), csrfToken: req.webSession.csrfSecret, mfa: 'none' });
}

// POST /api/auth/web/logout — yalnızca BU oturumu siler.
// Geçerli bir oturum varsa Origin + CSRF zorunlu. Oturum zaten geçersizse silinecek bir şey
// yoktur; HttpOnly çerez JS'ten silinemediği için yine de temizleme başlığı dönülür.
async function webLogout(req, res, next) {
  try {
    const rawId = getSessionCookie(req);
    if (rawId) {
      const resolved = await resolveWebSession(rawId);
      if (resolved) {
        if (enforceWriteGuards(req, res, resolved.session)) return;
        await revokeWebSession(rawId);
      }
    }
    clearSessionCookie(res);
    res.set('Cache-Control', 'no-store');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/web/logout-all — kullanıcının BÜTÜN web oturumlarını siler (mobil JWT'ler hariç).
async function webLogoutAll(req, res, next) {
  try {
    const count = await revokeAllWebSessions(req.user.id, 'logout_all');
    if (count === null) return next(new Error('Web oturumları iptal edilemedi'));
    logRequest({ req, page: 'Web Giriş', action: 'Tüm cihazlardan çıkış yaptı' }).catch(() => {});
    clearSessionCookie(res);
    res.set('Cache-Control', 'no-store');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { webLogin, webGoogleLogin, getWebSession, webLogout, webLogoutAll };
