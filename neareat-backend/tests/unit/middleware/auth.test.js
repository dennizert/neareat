'use strict';

// --- Mock all external dependencies before requiring the module under test ---
// firebase yalnızca FCM/messaging için kullanılıyor; auth middleware artık
// Google OAuth idToken'ı google-auth-library (services/googleAuth) ile doğruluyor.
jest.mock('../../../src/services/googleAuth', () => ({
  verifyGoogleIdToken: jest.fn(),
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id',
}));
jest.mock('../../../src/utils/prisma', () => ({
  user: { findUnique: jest.fn() },
}));
jest.mock('../../../src/utils/jwt');

const { verifyGoogleIdToken } = require('../../../src/services/googleAuth');
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

  // Default Google OAuth mock — overridden per test where needed
  verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });
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
// JWT path falls through to Google
// ---------------------------------------------------------------------------

describe('authenticate — JWT falls through to Google', () => {
  it('falls through to Google when JWT decoded sub has no matching user in DB', async () => {
    verifyToken.mockReturnValue({ sub: 'user-123' });
    // First findUnique call (JWT path) returns null → falls through
    // Second findUnique call (Google path) returns a valid user
    const googleUser = { id: 'g-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)       // JWT DB lookup fails
      .mockResolvedValueOnce(googleUser); // Google DB lookup succeeds

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('ambiguous-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(googleUser);
  });

  it('falls through to Google when verifyToken throws', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt invalid'); });
    const googleUser = { id: 'g-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(googleUser);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('google-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(googleUser);
  });

  it('falls through to Google when verifyToken returns null/undefined decoded', async () => {
    verifyToken.mockReturnValue(null);
    const googleUser = { id: 'g-user-2', role: 'RESTAURANT', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(googleUser);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('google-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(googleUser);
  });
});

// ---------------------------------------------------------------------------
// Google path — success cases
// ---------------------------------------------------------------------------

describe('authenticate — Google token', () => {
  beforeEach(() => {
    // Make JWT path always fail / find nothing so Google path is exercised
    verifyToken.mockImplementation(() => { throw new Error('not a jwt'); });
  });

  it('calls next() and sets req.user when Google token is valid and user is found', async () => {
    const user = { id: 'g-user', role: 'USER', isSuspended: false };
    prisma.user.findUnique.mockResolvedValue(user);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('google-id-token');
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBe(user);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 "User not found" when Google token is valid but user does not exist in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('google-id-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 "Hesabınız askıya alınmıştır." when Google user is suspended', async () => {
    const user = { id: 'g-user', role: 'USER', isSuspended: true };
    prisma.user.findUnique.mockResolvedValue(user);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'google-sub' });

    const req = makeReq('google-id-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Hesabınız askıya alınmıştır.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Both JWT and Google fail
// ---------------------------------------------------------------------------

describe('authenticate — both JWT and Google fail', () => {
  it('returns 401 "Invalid or expired token" when both JWT and Google verification fail', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt bad'); });
    verifyGoogleIdToken.mockRejectedValue(new Error('google bad'));

    const req = makeReq('totally-invalid-token');
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next() when both paths fail', async () => {
    verifyToken.mockImplementation(() => { throw new Error('jwt bad'); });
    verifyGoogleIdToken.mockRejectedValue(new Error('google bad'));

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

  it('sets req.user to the exact user object from prisma on Google path', async () => {
    verifyToken.mockImplementation(() => { throw new Error('not jwt'); });
    const user = { id: 'u-2', role: 'RESTAURANT', isSuspended: false, googleId: 'gid-abc' };
    prisma.user.findUnique.mockResolvedValue(user);

    verifyGoogleIdToken.mockResolvedValue({ sub: 'gid-abc' });

    const req = makeReq('google-token');
    await authenticate(req, res, next);

    expect(req.user).toEqual(user);
  });
});
