'use strict';

const { getCountryCode } = require('../../../src/utils/cityCountry');

describe('getCountryCode', () => {
  it('Türk illeri için TR döner', () => {
    expect(getCountryCode('İstanbul')).toBe('TR');
    expect(getCountryCode('Ankara')).toBe('TR');
    expect(getCountryCode('Ardahan')).toBe('TR');
  });

  it('büyük/küçük harf ve boşluk duyarsız (Türkçe locale)', () => {
    expect(getCountryCode('  istanbul ')).toBe('TR');
    expect(getCountryCode('İZMİR')).toBe('TR');
  });

  it('yabancı şehirler için doğru ülke kodu döner', () => {
    expect(getCountryCode('Berlin')).toBe('DE');
    expect(getCountryCode('Londra')).toBe('GB');
    expect(getCountryCode('Paris')).toBe('FR');
  });

  it('bilinmeyen şehir / boş için null döner', () => {
    expect(getCountryCode('Atlantis')).toBeNull();
    expect(getCountryCode('')).toBeNull();
    expect(getCountryCode(null)).toBeNull();
    expect(getCountryCode(undefined)).toBeNull();
  });
});
