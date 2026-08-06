'use strict';

/**
 * Sosyal gizlilik kuralları (S22-2) — saf, DB yok.
 *
 * KVKK açısından kritik: ikisi de bozulduğunda hata üretmez, sessizce yanlış çalışır
 * (gerçek ad sızar / gizli profil açılır). Bu yüzden doğrudan ve ayrıntılı test edilir.
 */

const { maskName, canViewUserContent, RANK_MEDALS } = require('../../../src/utils/socialPrivacy');

describe('maskName', () => {
  it('tek kelimelik adı ilk 2 harfe indirger', () => {
    expect(maskName('Deniz')).toBe('De...');
  });

  it('ad + soyadı maskeler', () => {
    expect(maskName('Deniz Ertekin')).toBe('De. Er...');
  });

  it('üç kelimede ilk ve SON kelimeyi kullanır', () => {
    expect(maskName('Ali Veli Kaya')).toBe('Al. Ka...');
  });

  it('baştaki/sondaki boşluklardan etkilenmez', () => {
    expect(maskName('  Deniz Ertekin  ')).toBe('De. Er...');
  });

  it('boş/null/undefined güvenli', () => {
    expect(maskName('')).toBe('...');
    expect(maskName(null)).toBe('...');
    expect(maskName(undefined)).toBe('...');
  });

  it('tam adı ASLA olduğu gibi döndürmez', () => {
    for (const name of ['Deniz', 'Deniz Ertekin', 'Ali Veli Kaya']) {
      expect(maskName(name)).not.toBe(name);
    }
  });

  it('2 harften kısa adlarda çökmez', () => {
    expect(maskName('A')).toBe('A...');
    expect(maskName('A B')).toBe('A. B...');
  });
});

describe('canViewUserContent', () => {
  it('açık profil herkese görünür', () => {
    expect(canViewUserContent({ isPublic: true, isSelf: false, isFriend: false })).toBe(true);
  });

  it('kendi profilin her zaman görünür (gizli olsa bile)', () => {
    expect(canViewUserContent({ isPublic: false, isSelf: true, isFriend: false })).toBe(true);
  });

  it('gizli profil arkadaşa görünür', () => {
    expect(canViewUserContent({ isPublic: false, isSelf: false, isFriend: true })).toBe(true);
  });

  it('gizli profil YABANCIYA GÖRÜNMEZ', () => {
    expect(canViewUserContent({ isPublic: false, isSelf: false, isFriend: false })).toBe(false);
  });

  it('eksik alanlar güvenli tarafta kalır (görünmez)', () => {
    expect(canViewUserContent({})).toBe(false);
  });
});

describe('RANK_MEDALS', () => {
  it('ilk 5 sıra için madalya tanımlı ve donmuş', () => {
    expect(RANK_MEDALS).toHaveLength(5);
    expect(Object.isFrozen(RANK_MEDALS)).toBe(true);
  });
});
