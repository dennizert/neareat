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

describe('tokenHash üretim sertleştirmesi (S12-2)', () => {
  const ORIG = { ...process.env };
  afterEach(() => { process.env = { ...ORIG }; });

  it('üretimde TOKEN_HASH_SECRET/JWT_SECRET yoksa modül yüklenirken hata fırlatır (sabit fallback kullanılmaz)', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    delete process.env.TOKEN_HASH_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => require('../../../src/utils/tokenHash')).toThrow(/TOKEN_HASH_SECRET/);
  });

  it('üretimde secret tanımlıysa sorunsuz yüklenir', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.TOKEN_HASH_SECRET = 'x'.repeat(32);
    const mod = require('../../../src/utils/tokenHash');
    expect(mod.hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});
