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

/**
 * Anthropic API response mock — Sprint-1 Task #6
 * client.messages.create() çıktısını simüle eder.
 *
 * @param {object} opts
 * @param {Array<{placeId: string, reason: string}>} [opts.recommendations]
 * @param {string} [opts.noteToUser]
 * @param {string} [opts.rawText] - override JSON; ham metin döner
 * @param {object} [opts.usage] - input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
 * @returns {object} Anthropic Message shape
 */
function mockAnthropicResponse(opts = {}) {
  const recommendations = opts.recommendations || [
    { placeId: 'p1', reason: 'Test gerekçesi bir.' },
    { placeId: 'p2', reason: 'Test gerekçesi iki.' },
  ];
  const body = opts.rawText != null
    ? opts.rawText
    : JSON.stringify({ recommendations, noteToUser: opts.noteToUser ?? '' });

  return {
    id: 'msg_test_' + Math.random().toString(36).slice(2, 10),
    type: 'message',
    role: 'assistant',
    model: opts.model || 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text: body }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: opts.usage?.input_tokens ?? 100,
      output_tokens: opts.usage?.output_tokens ?? 50,
      cache_creation_input_tokens: opts.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: opts.usage?.cache_read_input_tokens ?? 0,
    },
  };
}

module.exports = { createTestToken, randomId, createTestUser, mockAnthropicResponse };
