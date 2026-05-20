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
