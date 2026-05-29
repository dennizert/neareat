/**
 * Şehir (il) → ülke kodu eşlemesi.
 *
 * Mobil tarafındaki `src/data/countriesAndCities.ts` haritasının backend portu.
 * Profilde yalnızca `city` (il) saklanıyor; ülke bu şehirden türetiliyor.
 * Arkadaş önerisinde "aynı ülke" sinyali için kullanılır (aynı il daha güçlü ağırlık alır).
 *
 * Not: Mobildeki liste güncellenirse burası da güncellenmelidir.
 */

const COUNTRY_CITIES = {
  TR: [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
    'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
    'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
    'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
    'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
    'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
    'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt',
    'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
    'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman',
    'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
  ],
  DE: ['Berlin', 'Hamburg', 'Münih', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden'],
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Miami', 'Seattle', 'Boston', 'Denver'],
  AZ: ['Bakü', 'Gence', 'Sumgayıt', 'Mingəçevir', 'Nakhchivan'],
  BE: ['Brüksel', 'Antwerp', 'Gent', 'Charleroi', 'Liège', 'Brugge'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'],
  DK: ['Kopenhag', 'Aarhus', 'Odense', 'Aalborg'],
  EG: ['Kahire', 'İskenderiye', 'Giza', 'Sharm El Sheikh', 'Hurghada'],
  FR: ['Paris', 'Marsilya', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux', 'Lille', 'Rennes'],
  NL: ['Amsterdam', 'Rotterdam', 'Lahey', 'Utrecht', 'Eindhoven'],
  GB: ['Londra', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Edinburgh', 'Cardiff'],
  ES: ['Madrid', 'Barselona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Bilbao', 'Palma'],
  SE: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping'],
  CH: ['Zürih', 'Cenevre', 'Basel', 'Bern', 'Lozan'],
  IT: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Cenova', 'Bologna', 'Floransa', 'Venedik'],
  JP: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Hiroshima'],
  QA: ['Doha', 'Al Rayyan', 'Al Wakrah'],
  CY: ['Lefkoşa', 'Gazimağusa', 'Girne', 'Baf', 'Larnaka'],
  CA: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec'],
  KZ: ['Almatı', 'Nur-Sultan', 'Şımkent', 'Karagandı'],
  KW: ['Kuveyt Şehri', 'Salmiya', 'Hawalli'],
  NO: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  AT: ['Viyana', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  PL: ['Varşova', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk'],
  PT: ['Lizbon', 'Porto', 'Braga', 'Coimbra', 'Funchal'],
  RO: ['Bükreş', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța'],
  SA: ['Riyad', 'Cidde', 'Mekke', 'Medine', 'Dammam'],
  GR: ['Atina', 'Selanik', 'Patras', 'Iraklion', 'Rhodes'],
  BG: ['Sofya', 'Plovdiv', 'Varna', 'Burgaz', 'Ruse'],
  HR: ['Zagreb', 'Split', 'Rijeka', 'Dubrovnik', 'Zadar'],
  AU: ['Sidney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
};

// city (normalize edilmiş) → ülke kodu
const CITY_TO_COUNTRY = new Map();
for (const [code, cities] of Object.entries(COUNTRY_CITIES)) {
  for (const city of cities) {
    CITY_TO_COUNTRY.set(city.trim().toLocaleLowerCase('tr-TR'), code);
  }
}

/**
 * Şehirden ülke kodunu döndürür (bulunamazsa null).
 * @param {string|null|undefined} city
 * @returns {string|null}
 */
function getCountryCode(city) {
  if (!city) return null;
  return CITY_TO_COUNTRY.get(String(city).trim().toLocaleLowerCase('tr-TR')) || null;
}

module.exports = { getCountryCode, CITY_TO_COUNTRY };
