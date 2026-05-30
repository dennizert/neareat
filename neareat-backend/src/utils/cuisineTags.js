/**
 * Mutfak tipi etiketleri (Sprint-6 #85).
 *
 * Google Places `types` ve restoran isminden mutfak/kategori etiketleri türetir.
 * Google'ın kendi type'ları ("restaurant", "cafe", ...) çok kaba; kullanıcı
 * "kebap", "deniz ürünleri", "vejetaryen" gibi pratik filtreler istiyor.
 *
 * Eşleştirme normalize edilmiş (ASCII fold) isim üzerinde substring + types
 * üzerinde set lookup yapar. Bir mekan birden fazla etiket alabilir (örn.
 * "Pizza" + "İtalyan").
 */

const { normalizeName } = require('../services/googlePlaces');

/**
 * @typedef {{ tag: string, types?: string[], keywords?: string[] }} TagDef
 */

/** @type {TagDef[]} */
const TAG_DEFS = [
  { tag: 'Pizza',           keywords: ['pizza', 'pizzeria'] },
  { tag: 'Burger',          keywords: ['burger', 'hamburger'] },
  {
    tag: 'Kebap',
    keywords: ['kebap', 'kebab', 'doner', 'kokorec', 'cag kebabi', 'durum', 'iskender'],
  },
  {
    tag: 'Pide & Lahmacun',
    keywords: ['pide', 'lahmacun', 'etliekmek', 'etli ekmek'],
  },
  {
    tag: 'Türk Mutfağı',
    keywords: [
      'lokanta', 'ev yemekleri', 'ev yemegi', 'corba', 'sofra',
      'manti', 'tandir', 'gozleme', 'borek', 'kumru',
      'cig kofte', 'cigkofte', 'kofte', 'kuru fasulye',
    ],
  },
  {
    tag: 'Deniz Ürünleri',
    keywords: ['balik', 'deniz', 'seafood', 'fish', 'midye', 'sea food'],
  },
  {
    tag: 'Kahvaltı',
    keywords: ['kahvalti', 'breakfast', 'serpme'],
  },
  {
    tag: 'Tatlı',
    types: ['bakery'],
    keywords: [
      'baklava', 'kunefe', 'dondurma', 'pastane', 'patisserie',
      'tatlici', 'pastry', 'simit', 'unlu mamul', 'unlu mamuller',
      // #139 — yaygın Türkçe tatlı mekanları
      'muhallebi', 'sutlac', 'kazandibi', 'lokum',
    ],
  },
  {
    tag: 'Sushi / Asya',
    keywords: [
      'sushi', 'japan', 'japon', 'thai', 'cin', 'chinese',
      'kore', 'korean', 'asian', 'asya', 'ramen', 'pho', 'wok',
    ],
  },
  {
    tag: 'İtalyan',
    keywords: ['italian', 'italyan', 'pasta', 'risotto', 'pizzeria'],
  },
  {
    tag: 'Vejetaryen / Vegan',
    keywords: ['vegan', 'vejetaryen', 'vegetarian'],
  },
  {
    tag: 'Kafe',
    types: ['cafe'],
    keywords: ['kahve', 'coffee'],
  },
  {
    tag: 'Fast Food',
    types: ['meal_takeaway', 'meal_delivery'],
    keywords: ['fast food', 'fastfood'],
  },
];

/**
 * Bir Google Places sonucundan mutfak etiketlerini üretir.
 * @param {{ name?: string, types?: string[] }} place
 * @returns {string[]} eşleşen etiketler (her biri TAG_DEFS'teki gibi)
 */
function deriveCuisineTags(place) {
  const norm = normalizeName(place?.name);
  const typeSet = new Set(place?.types || []);
  const tags = new Set();
  for (const def of TAG_DEFS) {
    if (def.types?.some((t) => typeSet.has(t))) { tags.add(def.tag); continue; }
    if (norm && def.keywords?.some((k) => norm.includes(k))) tags.add(def.tag);
  }
  return [...tags];
}

/**
 * Virgülle ayrılmış cuisineTag query parametresini parse eder.
 * Bilinmeyen etiketler sessizce yok sayılır.
 * @param {string|undefined} raw
 * @returns {string[]}
 */
function parseCuisineTagFilter(raw) {
  if (!raw) return [];
  const known = new Set(TAG_DEFS.map((d) => d.tag));
  return String(raw)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => known.has(t));
}

module.exports = { deriveCuisineTags, parseCuisineTagFilter, TAG_DEFS };
