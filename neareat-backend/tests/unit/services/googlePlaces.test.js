'use strict';

/**
 * İsim bazlı dışlama filtresi testleri (saf fonksiyon, DB/ağ yok).
 */

const {
  isExcludedByName,
  normalizeName,
  passesQualityFilter,
} = require('../../../src/services/googlePlaces');

describe('normalizeName', () => {
  it('Türkçe karakterleri ASCII\'ye indirir + küçük harf', () => {
    expect(normalizeName('FIRIN')).toBe('firin');
    expect(normalizeName('Çay Bahçesi')).toBe('cay bahcesi');
    expect(normalizeName('Büfe')).toBe('bufe');
    expect(normalizeName('İstanbul Stüdyo')).toBe('istanbul studyo');
  });
  it('boş/null güvenli', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('isExcludedByName', () => {
  it.each([
    'Şükrü Bayi',
    'Merkez Kıraathanesi',
    'Özçevik Kırathanesi',  // yaygın yanlış yazım — kirathane varyantı
    'Köşe Kahvehanesi',
    'Sıcak Çayhane',
    'Yeşil Çay Bahçesi',
    'Halk Ekmek Büfesi',
    'Taş Fırın',
    'Reform Pilates Studio',
    'Köşe Büfe',
    'A101 Market',
    'CarrefourSA Süpermarket',
    'PlayStation Cafe',
    'Oyun Salonu',
    'Game House',
    'Gaming Lounge',
    // Grup A
    'Şık Kuaför',
    'Merkez Eczanesi',
    'Power Gym',
    'Ziraat Bankası',
    'Shell Akaryakıt',
    'Özel Diş Kliniği',
    'Bahçeşehir Koleji',
    'Remax Emlak',
    'Patiköy Veteriner',
    'Net Optik',
    'Altın Kuyumcu',
    'Stil Mobilya',
    'Moda Butik',
    'Gül Çiçekçi',
    'Minik Eller Anaokulu',
    // Grup B
    'Hilton Otel',
    'Görkem Düğün Salonu',
    'Forum AVM',
    'Star Bilardo',
    'Cafe İnternet Kafe',
    'Keyif Nargile',
    'Maslak Plaza İş Merkezi',
    // Grup C
    'Ankara Kasap',
    'Taze Manav',
    'Lezzet Şarküteri',
    'Çerez Kuruyemiş',
    'Yeni Tekel',
  ])('istenmeyen ismi eler: %s', (name) => {
    expect(isExcludedByName(name)).toBe(true);
  });

  it.each([
    'Kebapçı Mehmet',
    'Pizza Roma',
    'Lezzet Lokantası',
    'Deniz Restaurant',
    'Sushi Bar',
    'Bayındır Lokantası', // "bayi"+n → farklı kök, elenmez
    'Oyuncak Cafe',       // "oyun"+c → farklı kök, elenmez
    'Sushi Express',      // "su" eklenmedi → elenmez
    'Atmosfer Bistro',    // "atm" eklenmedi → elenmez
    'Deli Dana Steakhouse', // "deli" eklenmedi → elenmez
    'Kasaba Restaurant',  // "kasap" var ama "kasaba" farklı → elenmez
    'Beer Bar',           // "bar" eklenmedi → elenmez
    'Antep Kebap Salonu', // bare "salon" kaldırıldı → yemek bağlamı korunur
    'Çay Salonu',         // aynı — Türkçe'de yemek mekanı için yaygın
  ])('normal restoranı elemez: %s', (name) => {
    expect(isExcludedByName(name)).toBe(false);
  });

  it('Türkçe ek alan istenmeyen isimleri de eler', () => {
    expect(isExcludedByName('Merkez Kıraathanesi')).toBe(true); // +si
    expect(isExcludedByName('Taş Fırını')).toBe(true);          // +ı
    expect(isExcludedByName('A101 Marketi')).toBe(true);        // +i
    expect(isExcludedByName('Köşe Büfesi')).toBe(true);         // +si
  });

  it('boş isim için false', () => {
    expect(isExcludedByName('')).toBe(false);
    expect(isExcludedByName(null)).toBe(false);
  });
});

describe('passesQualityFilter — isim elemesi', () => {
  const good = { name: 'Lezzet Restaurant', rating: 4.5, user_ratings_total: 120 };
  const badName = { name: 'Halk Ekmek Fırını', rating: 4.9, user_ratings_total: 500 };

  it('kaliteli + uygun isim → geçer', () => {
    expect(passesQualityFilter(good)).toBe(true);
  });
  it('yüksek puanlı olsa bile istenmeyen isim → elenir', () => {
    expect(passesQualityFilter(badName)).toBe(false);
  });
});
