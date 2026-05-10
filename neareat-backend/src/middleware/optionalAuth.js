const { getAuth } = require('../services/firebase');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');

// Like authenticate but doesn't fail when no token — req.user stays null
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    if (decoded?.sub) {
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (user && !user.isSuspended) {
        req.user = user;
        return next();
      }
    }
  } catch {
    // try Firebase
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const user = await prisma.user.findUnique({ where: { googleId: decoded.uid } });
    if (user && !user.isSuspended) {
      req.user = user;
      return next();
    }
  } catch {
    // invalid token — treat as unauthenticated
  }

  req.user = null;
  next();
}

module.exports = optionalAuthenticate;
