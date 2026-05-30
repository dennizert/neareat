'use strict';

/**
 * Sprint-6 #85 — mutfak etiketi türetme (saf fonksiyon).
 */

const { deriveCuisineTags, parseCuisineTagFilter, TAG_DEFS } = require('../../../src/utils/cuisineTags');

function place(name, types = ['restaurant']) {
  return { name, types };
}

describe('deriveCuisineTags', () => {
  it.each([
    ['Domino\'s Pizza',           ['Pizza']],
    ['Burger House',              ['Burger']],
    ['Kasap Ali Kebap',           ['Kebap']],
    ['Antep Lahmacun Pide',       ['Pide & Lahmacun']],
    ['Ev Yemekleri Lokantası',    ['Türk Mutfağı']],
    ['Balık Pazarı Restaurant',   ['Deniz Ürünleri']],
    ['Serpme Kahvaltı Bahçesi',   ['Kahvaltı']],
    ['Antep Baklavacısı',         ['Tatlı']],
    ['Sushi Tokyo',               ['Sushi / Asya']],
    ['Mama Mia Pasta',            ['İtalyan']],
    ['Vegan Garden',              ['Vejetaryen / Vegan']],
  ])('%s → %p', (name, expected) => {
    const tags = deriveCuisineTags(place(name));
    for (const e of expected) expect(tags).toContain(e);
  });

  it('Google types üzerinden de etiketler (cafe → Kafe)', () => {
    expect(deriveCuisineTags(place('Brew Mood', ['cafe']))).toContain('Kafe');
  });

  it('meal_takeaway → Fast Food', () => {
    expect(deriveCuisineTags(place('Chicken King', ['meal_takeaway']))).toContain('Fast Food');
  });

  it('bilinmeyen ismi etiketsiz bırakır (sadece "restaurant" tipi)', () => {
    expect(deriveCuisineTags(place('Lezzet Köşesi'))).toEqual([]);
  });

  it('Türkçe karakter + büyük harf duyarsız (FIRIN → bakery type fallback gerekmez, ama Pide eşleşir)', () => {
    expect(deriveCuisineTags(place('Etliekmek Konyalı'))).toContain('Pide & Lahmacun');
    expect(deriveCuisineTags(place('TÜRK MANTI EVİ'))).toContain('Türk Mutfağı');
  });

  it('birden fazla etiket dönebilir (Pizzeria → Pizza + İtalyan)', () => {
    const tags = deriveCuisineTags(place('Pizzeria Roma'));
    expect(tags).toEqual(expect.arrayContaining(['Pizza', 'İtalyan']));
  });

  it('boş/null isim güvenli', () => {
    expect(deriveCuisineTags({ name: '', types: [] })).toEqual([]);
    expect(deriveCuisineTags({})).toEqual([]);
    expect(deriveCuisineTags(null)).toEqual([]);
  });
});

describe('parseCuisineTagFilter', () => {
  it('virgülle ayrılmış geçerli etiketleri döner', () => {
    expect(parseCuisineTagFilter('Pizza,Kebap')).toEqual(['Pizza', 'Kebap']);
  });
  it('bilinmeyen etiketleri sessizce eler', () => {
    expect(parseCuisineTagFilter('Pizza,Uzaylı Yemek,Kebap')).toEqual(['Pizza', 'Kebap']);
  });
  it('boş/null → boş dizi', () => {
    expect(parseCuisineTagFilter('')).toEqual([]);
    expect(parseCuisineTagFilter(undefined)).toEqual([]);
    expect(parseCuisineTagFilter(null)).toEqual([]);
  });
  it('boşluk toleranslı', () => {
    expect(parseCuisineTagFilter(' Pizza , Kebap ')).toEqual(['Pizza', 'Kebap']);
  });
});

describe('TAG_DEFS sanity', () => {
  it('etiket adları benzersiz', () => {
    const names = TAG_DEFS.map((d) => d.tag);
    expect(new Set(names).size).toBe(names.length);
  });
});
