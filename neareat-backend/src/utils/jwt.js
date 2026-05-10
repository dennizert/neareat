const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('[FATAL] JWT_SECRET env var is not set — sunucu başlatılmıyor');
  process.exit(1);
}

const ALGORITHM = 'HS256';

function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d', algorithm: ALGORITHM });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
