'use strict';

/**
 * optionalAuth — Google ile giren kullanıcı regresyonu.
 *
 * Bu middleware kendi kopyasında FIREBASE token'ı doğruluyordu
 * (`getAuth().verifyIdToken` + `googleId: decoded.uid`), oysa mobil Google ile giren
 * kullanıcılar için her istekte HAM Google OAuth idToken'ı gönderiyor
 * (services/auth.ts → `setTokenGetter(getGoogleIdToken)`). Sonuç: bu kullanıcılar
 * `/restaurants/nearby` ve `/places/search` uçlarında sessizce ANONİM sayılıyordu —
 * nearby'de `userLevel` 1'e düşüyor (kartlardaki yıldız indirimi kayboluyor) ve
 * arama geçmişi hiç yazılmıyordu (AI prompt'undaki recentSearches zayıflıyor).
 *
 * Artık token çözümü `utils/resolveTokenUser` ile `authenticate` ile paylaşılıyor.
 */

jest.mock('../../../src/services/googleAuth', () => ({
  verifyGoogleIdToken: jest.fn(),
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id',
}));
jest.mock('../../../src/utils/prisma', () => ({ user: { findUnique: jest.fn() } }));
jest.mock('../../../src/utils/jwt');

const { verifyGoogleIdToken } = require('../../../src/services/googleAuth');
const prisma = require('../../../src/utils/prisma');
const { verifyToken } = require('../../../src/utils/jwt');
const optionalAuthenticate = require('../../../src/middleware/optionalAuth');

const JWT_USER = { id: 'u-jwt', isSuspended: false, starCount: 120 };
const GOOGLE_USER = { id: 'u-google', googleId: 'g-sub-1', isSuspended: false, starCount: 200 };

function makeReq(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {}, ip: '127.0.0.1', path: '/t', id: 'r1' };
}

beforeEach(() => {
  jest.clearAllMocks();
  verifyToken.mockImplementation(() => { throw new Error('not a jwt'); });
  verifyGoogleIdToken.mockRejectedValue(new Error('not a google token'));
  prisma.user.findUnique.mockResolvedValue(null);
});

describe('optionalAuth', () => {
  it('token yoksa anonim geçer (req.user null)', async () => {
    const req = makeReq(null); const next = jest.fn();
    await optionalAuthenticate(req, {}, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('custom JWT ile kullanıcıyı tanır', async () => {
    verifyToken.mockReturnValue({ sub: JWT_USER.id });
    prisma.user.findUnique.mockResolvedValue(JWT_USER);

    const req = makeReq('jwt-token'); const next = jest.fn();
    await optionalAuthenticate(req, {}, next);

    expect(req.user).toBe(JWT_USER);
    expect(next).toHaveBeenCalled();
  });

  // ASIL REGRESYON: önceden burada Firebase doğrulaması vardı → Google kullanıcısı
  // tanınmıyor, req.user null kalıyordu.
  it('Google OAuth idToken ile kullanıcıyı TANIR (regresyon)', async () => {
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-sub-1' });
    prisma.user.findUnique.mockResolvedValue(GOOGLE_USER);

    const req = makeReq('google-id-token'); const next = jest.fn();
    await optionalAuthenticate(req, {}, next);

    expect(req.user).toBe(GOOGLE_USER);
    // Google kullanıcısı googleId ile aranmalı (id ile değil)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-sub-1' } });
    expect(next).toHaveBeenCalled();
  });

  it('geçersiz token anonim sayılır, hata FIRLATMAZ', async () => {
    const req = makeReq('garbage'); const next = jest.fn();
    await optionalAuthenticate(req, {}, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('askıya alınmış hesap 403 değil, anonim olarak geçer (uç herkese açık)', async () => {
    verifyToken.mockReturnValue({ sub: 'u-sus' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u-sus', isSuspended: true });

    const req = makeReq('jwt-token'); const next = jest.fn();
    await optionalAuthenticate(req, {}, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
