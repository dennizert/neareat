'use strict';

/**
 * İsim bazlı dışlama filtresi testleri (saf fonksiyon, DB/ağ yok).
 */

const {
  isExcludedByName,
  normalizeName,
  passesQualityFilter,
  getPhotoUrl,
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
    // Grup D — otomotiv / teknik
    'Oto Tamiri',
    'Bozkurt Otomotiv',
    'Egzoz Merkezi',
    'Makine Mekanik',
    'Yiğit Elektrik',
    'Klima İklimlendirme',
    'Bilge Mühendislik',
    // Grup E — güzellik / eğlence / ticaret
    'Relax Spa',
    'Venue Club',
    'Aktif Pazarlama',
    'Doğa Kamping',
    'Lüks Halı',
    'PetShop Store',
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
    'Otobüs Terminali Lokantası', // oto+b (ünsüz) → elenmez
    'Haliç Panorama Restaurant',  // halic → hali+c (ünsüz) → elenmez
    'Otopark Restoranı',          // oto+p (ünsüz) → elenmez
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

describe('getPhotoUrl — maxWidth (S15-P3)', () => {
  it('varsayılan büyük boyut (detay ekranı) → maxwidth=800', () => {
    expect(getPhotoUrl('REF')).toContain('maxwidth=800');
    expect(getPhotoUrl('REF')).toContain('photo_reference=REF');
  });
  it('liste thumbnail boyutu → maxwidth=200', () => {
    expect(getPhotoUrl('REF', 200)).toContain('maxwidth=200');
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

describe('passesQualityFilter — anlamsız isim elemesi (Sprint-17 fix)', () => {
  it('yalnızca noktalama/sembol (".." / "-") → elenir', () => {
    expect(passesQualityFilter({ name: '..', rating: 5, user_ratings_total: 3 })).toBe(false);
    expect(passesQualityFilter({ name: '-', rating: 4.8, user_ratings_total: 10 })).toBe(false);
  });
  it('en az 2 harfli gerçek ad → geçer', () => {
    expect(passesQualityFilter({ name: 'Ev', rating: 4.5, user_ratings_total: 5 })).toBe(true);
  });
});

describe('passesQualityFilter — tip (types) bazlı eleme (Sprint-17 fix)', () => {
  it('yiyecek-dışı tip (premise/plaza) → restoran tipi olsa bile elenir', () => {
    const plaza = { name: 'Wings Ankara', rating: 4.1, user_ratings_total: 18, types: ['restaurant', 'premise', 'point_of_interest'] };
    expect(passesQualityFilter(plaza)).toBe(false);
  });
  it('güzellik salonu tipi → elenir', () => {
    const salon = { name: 'Stil Merkezi', rating: 4.9, user_ratings_total: 40, types: ['beauty_salon', 'point_of_interest', 'establishment'] };
    expect(passesQualityFilter(salon)).toBe(false);
  });
  it('types var ama hiç yeme-içme tipi yok → elenir', () => {
    const generic = { name: 'Bir Yer', rating: 4.5, user_ratings_total: 50, types: ['point_of_interest', 'establishment'] };
    expect(passesQualityFilter(generic)).toBe(false);
  });
  it('gerçek restoran tipi → geçer', () => {
    const r = { name: 'Köşk Restoran', rating: 4.5, user_ratings_total: 200, types: ['restaurant', 'food', 'point_of_interest', 'establishment'] };
    expect(passesQualityFilter(r)).toBe(true);
  });
  it('types alanı yoksa (geriye uyum) → tip kontrolü atlanır', () => {
    expect(passesQualityFilter({ name: 'Çınaraltı', rating: 4.2, user_ratings_total: 150 })).toBe(true);
  });
});
