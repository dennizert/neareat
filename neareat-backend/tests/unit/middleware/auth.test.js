'use strict';

// --- Mock all external dependencies before requiring the module under test ---
// Use a factory for firebase so that firebase-admin is NEVER initialised (it
// validates the private key at require-time and would throw with a dummy key).
jest.mock('../../../src/services/firebase', () => ({
  getAuth: jest.fn(),
  getMessaging: jest.fn(),
}));
jest.mock('../../../src/utils/prisma', () => ({
  user: { findUnique: jest.fn() },
}));
jest.mock('../../../src/utils/jwt');

const { getAuth } = require('../../../src/services/firebase');
const prisma = require('../../../src/utils/prisma');
const { verifyToken } = require('../../../src/utils/jwt');
const authenticate = require('../../../src/middleware/auth');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeReq(token) {
  return {
    headers: { authorization: `Bearer ${token}` },
    ip: '127.0.0.1',
    path: '/test',
    id: 'req-1',
  };
}

function makeReqNoAuth() {
  return {
    headers: {},
    ip: '127.0.0.1',
    path: '/test',
    id: 'req-1',
  };
}

function makeReqBadPrefix(token) {
  return {
    headers: { authorization: `Token ${token}` },
    ip: '127.0.0.1',
    path: '/test',
    id: 'req-1',
  };
}

let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();

  res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  next = jest.fn();

  // Default Firebase mock — overridden per test where needed
  getAuth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
  });
});

// ---------------------------------------------------------------------------
// Missing / malformed Authorization header
// ---------------------------------------------------------------------------

describe('authenticate — missing or malformed Authorization header', () => {
  it('returns 401 "Missing authorization token" when there is no Authorization header', async () => {
    const req = makeReqNoAuth();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authorization token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with "Bearer "', async () => {
    verifyToken.mockImplementation(() => { throw new Error('not reached'); });
    const req = makeReqBadPrefix('some-token');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authorization token' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// JWT path — success cases
// ---------------------------------------------------------------------------

describe('authenticate — valid JWT token', () => {
  it('calls next() and sets req.user when JWT is valid and user is found and not suspended', async () => {
    const user = { id: 'user-123', role: 'USER', isSuspended: false };
    verifyToken.mockReturnValue({ sub: 'user-123' });
    prisma.user.findUnique.mockResolvedValue(user);

    const req = makeReq('valid-jwt-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(user);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 "Hesabınız askıya alınmıştır." when JWT user is suspended', async () => {
    const user = { id: 'user-123', role: 'USER', isSuspended: true };
    verifyToken.mockReturnValue({ sub: 'user-123' });
    prisma.user.findUnique.mockResolvedValue(user);

    const req = makeReq('valid-jwt-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Hesabınız askıya alınmıştır.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// JWT path falls through to Firebase
// ---------------------------------------------------------------------------

describe('authenticate — JWT falls through to Firebase', () => {
  it('falls through to Firebase when JWT decoded sub has no matching user in DB', async () => {
    verifyToken.mockReturnValue({ sub: 'user-123' });
    // First findUnique call (JWT path) returns null → falls through
    // Second findUnique call (Firebase path) returns a valid user
    const firebaseUser = { id: 'fb-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)       // JWT DB lookup fails
      .mockResolvedValueOnce(firebaseUser); // Firebase DB lookup succeeds

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('ambiguous-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(firebaseUser);
  });

  it('falls through to Firebase when verifyToken throws', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt invalid'); });
    const firebaseUser = { id: 'fb-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(firebaseUser);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('firebase-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(firebaseUser);
  });

  it('falls through to Firebase when verifyToken returns null/undefined decoded', async () => {
    verifyToken.mockReturnValue(null);
    const firebaseUser = { id: 'fb-user-2', role: 'RESTAURANT', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(firebaseUser);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('firebase-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(firebaseUser);
  });
});

// ---------------------------------------------------------------------------
// Firebase path — success cases
// ---------------------------------------------------------------------------

describe('authenticate — Firebase token', () => {
  beforeEach(() => {
    // Make JWT path always fail / find nothing so Firebase path is exercised
    verifyToken.mockImplementation(() => { throw new Error('not a jwt'); });
  });

  it('calls next() and sets req.user when Firebase token is valid and user is found', async () => {
    const user = { id: 'fb-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(user);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('firebase-id-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(user);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 "User not found" when Firebase token is valid but user does not exist in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('firebase-id-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 "Hesabınız askıya alınmıştır." when Firebase user is suspended', async () => {
    const user = { id: 'fb-user', role: 'USER', isSuspended: true };
    prisma.user.findUnique.mockResolvedValue(user);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }),
    });

    const req = makeReq('firebase-id-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Hesabınız askıya alınmıştır.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Both JWT and Firebase fail
// ---------------------------------------------------------------------------

describe('authenticate — both JWT and Firebase fail', () => {
  it('returns 401 "Invalid or expired token" when both JWT and Firebase verification fail', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt bad'); });

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('firebase bad')),
    });

    const req = makeReq('totally-invalid-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next() when both paths fail', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt bad'); });

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('firebase bad')),
    });

    const req = makeReq('bad-token');
    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// req.user is correctly set
// ---------------------------------------------------------------------------

describe('authenticate — req.user assignment', () => {
  it('sets req.user to the exact user object from prisma on JWT path', async () => {
    const user = { id: 'u-1', role: 'ADMIN', isSuspended: false, email: 'admin@test.com' };
    verifyToken.mockReturnValue({ sub: 'u-1' });
    prisma.user.findUnique.mockResolvedValue(user);

    const req = makeReq('admin-token');
    await authenticate(req, res, next);

    expect(req.user).toEqual(user);
  });

  it('sets req.user to the exact user object from prisma on Firebase path', async () => {
    verifyToken.mockImplementation(() => { throw new Error('not jwt'); });
    const user = { id: 'u-2', role: 'RESTAURANT', isSuspended: false, googleId: 'gid-abc' };
    prisma.user.findUnique.mockResolvedValue(user);

    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'gid-abc' }),
    });

    const req = makeReq('firebase-token');
    await authenticate(req, res, next);

    expect(req.user).toEqual(user);
  });
});
