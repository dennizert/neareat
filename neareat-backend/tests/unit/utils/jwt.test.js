'use strict';

const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../../../src/utils/jwt');

describe('signToken', () => {
  it('returns a non-empty string', () => {
    const token = signToken('user-123');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces different tokens for different userIds', () => {
    const t1 = signToken('user-1');
    const t2 = signToken('user-2');
    expect(t1).not.toBe(t2);
  });

  it('token exp minus iat equals approximately 604800 (7 days)', () => {
    const token = signToken('user-123');
    const decoded = jwt.decode(token);
    expect(decoded.exp - decoded.iat).toBe(604800);
  });
});

describe('verifyToken', () => {
  it('returns an object with sub equal to the userId on a valid token', () => {
    const token = signToken('user-abc');
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ sub: 'user-abc' });
  });

  it('throws JsonWebTokenError on a tampered token', () => {
    const token = signToken('user-123');
    const parts = token.split('.');
    parts[2] = parts[2].split('').reverse().join('');
    const tampered = parts.join('.');
    expect(() => verifyToken(tampered)).toThrow(jwt.JsonWebTokenError);
  });

  it('throws TokenExpiredError on an expired token', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-expired' },
      process.env.JWT_SECRET,
      { expiresIn: '0s', algorithm: 'HS256' }
    );
    expect(() => verifyToken(expiredToken)).toThrow(jwt.TokenExpiredError);
  });

  it('throws on an empty string', () => {
    expect(() => verifyToken('')).toThrow();
  });

  it('throws on a malformed string', () => {
    expect(() => verifyToken('not.a.valid.jwt.token')).toThrow();
  });
});

// ─── Kesintisiz secret rotasyonu ─────────────────────────────────────────────
// İmzalama her zaman güncel secret ile; doğrulama güncel → (varsa) önceki sırasıyla.
// Amaç: JWT_SECRET değiştirildiğinde sahadaki oturumların düşmemesi.
describe('secret rotasyonu (JWT_PREVIOUS_SECRET)', () => {
  const CURRENT = 'yeni-secret-yeni-secret-yeni-secret-32';
  const PREVIOUS = 'eski-secret-eski-secret-eski-secret-32';

  /** jwt.js env'i modül yüklenirken okur → izole require ile tazeler. */
  function loadJwt({ current, previous }) {
    let mod;
    jest.isolateModules(() => {
      const prevEnv = { s: process.env.JWT_SECRET, p: process.env.JWT_PREVIOUS_SECRET };
      process.env.JWT_SECRET = current;
      if (previous) process.env.JWT_PREVIOUS_SECRET = previous;
      else delete process.env.JWT_PREVIOUS_SECRET;
      mod = require('../../../src/utils/jwt');
      process.env.JWT_SECRET = prevEnv.s;
      if (prevEnv.p === undefined) delete process.env.JWT_PREVIOUS_SECRET;
      else process.env.JWT_PREVIOUS_SECRET = prevEnv.p;
    });
    return mod;
  }

  it('ÖNCEKİ secret ile imzalanmış token kabul edilir (oturumlar düşmez)', () => {
    const oldToken = jwt.sign({ sub: 'u-1' }, PREVIOUS, { expiresIn: '7d', algorithm: 'HS256' });
    const { verifyToken: verify } = loadJwt({ current: CURRENT, previous: PREVIOUS });
    expect(verify(oldToken)).toMatchObject({ sub: 'u-1' });
  });

  it('güncel secret ile imzalanmış token da çalışmaya devam eder', () => {
    const { signToken: sign, verifyToken: verify } = loadJwt({ current: CURRENT, previous: PREVIOUS });
    expect(verify(sign('u-2'))).toMatchObject({ sub: 'u-2' });
  });

  it('yeni token GÜNCEL secret ile imzalanır (önceki ile doğrulanamaz)', () => {
    const { signToken: sign } = loadJwt({ current: CURRENT, previous: PREVIOUS });
    expect(() => jwt.verify(sign('u-3'), PREVIOUS, { algorithms: ['HS256'] })).toThrow();
    expect(jwt.verify(sign('u-3'), CURRENT, { algorithms: ['HS256'] })).toMatchObject({ sub: 'u-3' });
  });

  it('PREVIOUS tanımlı değilse eski token reddedilir (rotasyon tamamlandıktan sonra)', () => {
    const oldToken = jwt.sign({ sub: 'u-4' }, PREVIOUS, { expiresIn: '7d', algorithm: 'HS256' });
    const { verifyToken: verify } = loadJwt({ current: CURRENT, previous: null });
    // Not: isolateModules ayrı bir modül kaydı kullandığı için hata SINIFI kimliği
    // dışarıdaki jwt ile eşleşmez (instanceof başarısız) → mesaja göre doğrulanır.
    expect(() => verify(oldToken)).toThrow(/invalid signature/);
  });

  it('hiçbir secret ile eşleşmeyen token reddedilir', () => {
    const alien = jwt.sign({ sub: 'u-5' }, 'tamamen-baska-bir-secret-32-karakter', { algorithm: 'HS256' });
    const { verifyToken: verify } = loadJwt({ current: CURRENT, previous: PREVIOUS });
    expect(() => verify(alien)).toThrow(/invalid signature/);
  });

  it('önceki secret ile imzalı OLSA BİLE süresi dolmuş token reddedilir', () => {
    const expired = jwt.sign({ sub: 'u-6' }, PREVIOUS, { expiresIn: '0s', algorithm: 'HS256' });
    const { verifyToken: verify } = loadJwt({ current: CURRENT, previous: PREVIOUS });
    expect(() => verify(expired)).toThrow();
  });
});
