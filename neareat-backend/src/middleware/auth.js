const { resolveTokenUser } = require('../utils/resolveTokenUser');
const { logSecurityEvent, EVENTS } = require('./securityLogger');
const { hasSessionCookie, authenticateWithCookie } = require('./webSession');

// Korumalı route'ların kimlik doğrulama middleware'i. Bearer token'ı önce custom JWT
// (email/şifre) olarak, başarısızsa Google idToken olarak dener — iki auth stratejisi de
// aynı uçları kullanabilsin diye. Askıya alınmış (isSuspended) hesapları 403 ile keser ve
// req.user'ı doldurur. Başarısız denemeleri güvenlik loguna yazar.
//
// Token → kullanıcı çözümü `utils/resolveTokenUser` ile PAYLAŞILIR (optionalAuth da aynı
// çekirdeği kullanır); burada yalnızca HTTP yanıtı ve güvenlik loglaması yapılır.
//
// Web paneli (#524): Bearer başlığı YOKSA ve `__Host-eatlas_sid` çerezi varsa istek web
// oturumuyla doğrulanır (CSRF + Origin korumaları dahil — middleware/webSession.js).
// Bearer varsa çereze HİÇ bakılmaz: mobil davranışı birebir aynı kalır ve ikisi birden
// gelirse Bearer kazanır.
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (hasSessionCookie(req)) return authenticateWithCookie(req, res, next);
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const { user, outcome } = await resolveTokenUser(token);

  if (outcome === 'google_user_not_found') {
    logSecurityEvent(EVENTS.AUTH_FAILED, {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
      reason: 'firebase_user_not_found',
    });
    return res.status(401).json({ error: 'User not found' });
  }

  if (!user) {
    logSecurityEvent(EVENTS.AUTH_FAILED, {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
      reason: 'invalid_token',
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (user.isSuspended) {
    logSecurityEvent(EVENTS.SUSPENDED_ACCESS, {
      userId: user.id,
      ip: req.ip,
      path: req.path,
      requestId: req.id,
    });
    return res.status(403).json({ error: 'Hesabınız askıya alınmıştır.' });
  }

  req.user = user;
  next();
}

module.exports = authenticate;
