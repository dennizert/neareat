/**
 * Test yardımcıları — token oluşturma, mock kullanıcı, vs.
 */
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'test-secret-key-for-integration-tests';

/** Test kullanıcısı için JWT token oluştur */
function createTestToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '1h', algorithm: 'HS256' });
}

/** Rastgele UUID benzeri ID üret */
function randomId() {
  return 'test-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/** Test kullanıcısı verisi */
function createTestUser(overrides = {}) {
  const id = randomId();
  return {
    id,
    email: `testuser-${id}@test.com`,
    displayName: 'Test User',
    photoUrl: null,
    googleId: null,
    fcmToken: null,
    passwordHash: null,
    authProvider: 'email',
    role: 'USER',
    isSuspended: false,
    bio: null,
    city: null,
    favoriteCuisines: [],
    isPublic: true,
    starCount: 0,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

module.exports = { createTestToken, randomId, createTestUser };
