const { verifyGoogleIdToken } = require('../services/googleAuth');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');
const { logSecurityEvent, EVENTS } = require('./securityLogger');

// Korumalı route'ların kimlik doğrulama middleware'i. Bearer token'ı önce custom JWT
// (email/şifre) olarak, başarısızsa Google idToken olarak dener — iki auth stratejisi de
// aynı uçları kullanabilsin diye. Askıya alınmış (isSuspended) hesapları 403 ile keser ve
// req.user'ı doldurur. Başarısız denemeleri güvenlik loguna yazar.
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.split(' ')[1];

  // Önce custom JWT dene (email/password auth)
  try {
    const decoded = verifyToken(token);
    if (decoded?.sub) {
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (user) {
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
        return next();
      }
    }
  } catch {
    // JWT değil ya da geçersiz — Firebase'i dene
  }

  // Google OAuth idToken dene (Google auth)
  try {
    const decoded = await verifyGoogleIdToken(token);
    const user = await prisma.user.findUnique({ where: { googleId: decoded.sub } });
    if (!user) {
      logSecurityEvent(EVENTS.AUTH_FAILED, {
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        reason: 'firebase_user_not_found',
      });
      return res.status(401).json({ error: 'User not found' });
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
  } catch {
    logSecurityEvent(EVENTS.AUTH_FAILED, {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
      reason: 'invalid_token',
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
