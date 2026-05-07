const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'neareat-jwt-secret-dev';

function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
