'use strict';

const { hashToken } = require('../../../src/utils/tokenHash');

describe('hashToken', () => {
  it('deterministik ve 64 karakterlik hex döner', () => {
    const h1 = hashToken('abc-123');
    const h2 = hashToken('abc-123');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ham token ile aynı değildir (düz metin sızdırmaz)', () => {
    expect(hashToken('secret-token')).not.toBe('secret-token');
  });

  it('farklı girdiler farklı hash üretir', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
