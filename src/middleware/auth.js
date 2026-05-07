const { getAuth } = require('../services/firebase');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');

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
        req.user = user;
        return next();
      }
    }
  } catch {
    // JWT değil ya da geçersiz — Firebase'i dene
  }

  // Firebase token dene (Google auth)
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const user = await prisma.user.findUnique({ where: { googleId: decoded.uid } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
