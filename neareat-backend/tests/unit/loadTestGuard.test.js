'use strict';

/**
 * S16-9 — yük testi production-guard'ı (saf JS).
 */

const { isProductionUrl, resolveTarget } = require('../../load-tests/lib/guard');

describe('isProductionUrl', () => {
  it('bilinen production host → true', () => {
    expect(isProductionUrl('https://railway-up-production-6cdc.up.railway.app')).toBe(true);
  });
  it('"production" içeren host → true', () => {
    expect(isProductionUrl('https://api.production.example')).toBe(true);
  });
  it('staging/dev → false', () => {
    expect(isProductionUrl('https://staging.example')).toBe(false);
    expect(isProductionUrl('http://localhost:3000')).toBe(false);
  });
  it('boş → false', () => {
    expect(isProductionUrl('')).toBe(false);
    expect(isProductionUrl(undefined)).toBe(false);
  });
});

describe('resolveTarget', () => {
  it('BASE_URL yoksa hata', () => {
    expect(() => resolveTarget({})).toThrow(/BASE_URL/);
  });
  it('staging URL → trailing slash temizlenip döner', () => {
    expect(resolveTarget({ BASE_URL: 'https://staging.example/' })).toBe('https://staging.example');
  });
  it('production URL → guard hatası (ALLOW_PRODUCTION yok)', () => {
    expect(() => resolveTarget({ BASE_URL: 'https://railway-up-production-6cdc.up.railway.app' }))
      .toThrow(/production/i);
  });
  it('production URL + ALLOW_PRODUCTION=true → izin (bilinçli kaçış)', () => {
    const url = 'https://railway-up-production-6cdc.up.railway.app';
    expect(resolveTarget({ BASE_URL: url, ALLOW_PRODUCTION: 'true' })).toBe(url);
  });
});
