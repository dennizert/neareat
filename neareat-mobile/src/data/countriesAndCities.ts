export interface Country {
  code: string;
  name: string;
  cities: string[];
}

export const COUNTRIES: Country[] = [
  {
    code: 'TR',
    name: 'Türkiye',
    cities: [
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
  },
  {
    code: 'DE',
    name: 'Almanya',
    cities: ['Berlin', 'Hamburg', 'Münih', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden'],
  },
  {
    code: 'US',
    name: 'Amerika Birleşik Devletleri',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Miami', 'Seattle', 'Boston', 'Denver'],
  },
  {
    code: 'AZ',
    name: 'Azerbaycan',
    cities: ['Bakü', 'Gence', 'Sumgayıt', 'Mingəçevir', 'Nakhchivan'],
  },
  {
    code: 'BE',
    name: 'Belçika',
    cities: ['Brüksel', 'Antwerp', 'Gent', 'Charleroi', 'Liège', 'Brugge'],
  },
  {
    code: 'AE',
    name: 'Birleşik Arap Emirlikleri',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'],
  },
  {
    code: 'DK',
    name: 'Danimarka',
    cities: ['Kopenhag', 'Aarhus', 'Odense', 'Aalborg'],
  },
  {
    code: 'EG',
    name: 'Mısır',
    cities: ['Kahire', 'İskenderiye', 'Giza', 'Sharm El Sheikh', 'Hurghada'],
  },
  {
    code: 'FR',
    name: 'Fransa',
    cities: ['Paris', 'Marsilya', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux', 'Lille', 'Rennes'],
  },
  {
    code: 'NL',
    name: 'Hollanda',
    cities: ['Amsterdam', 'Rotterdam', 'Lahey', 'Utrecht', 'Eindhoven'],
  },
  {
    code: 'GB',
    name: 'İngiltere',
    cities: ['Londra', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Leeds', 'Edinburgh', 'Cardiff'],
  },
  {
    code: 'ES',
    name: 'İspanya',
    cities: ['Madrid', 'Barselona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Bilbao', 'Palma'],
  },
  {
    code: 'SE',
    name: 'İsveç',
    cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping'],
  },
  {
    code: 'CH',
    name: 'İsviçre',
    cities: ['Zürih', 'Cenevre', 'Basel', 'Bern', 'Lozan'],
  },
  {
    code: 'IT',
    name: 'İtalya',
    cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Cenova', 'Bologna', 'Floransa', 'Venedik'],
  },
  {
    code: 'JP',
    name: 'Japonya',
    cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Hiroshima'],
  },
  {
    code: 'QA',
    name: 'Katar',
    cities: ['Doha', 'Al Rayyan', 'Al Wakrah'],
  },
  {
    code: 'CY',
    name: 'Kıbrıs',
    cities: ['Lefkoşa', 'Gazimağusa', 'Girne', 'Baf', 'Larnaka'],
  },
  {
    code: 'CA',
    name: 'Kanada',
    cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec'],
  },
  {
    code: 'KZ',
    name: 'Kazakistan',
    cities: ['Almatı', 'Nur-Sultan', 'Şımkent', 'Karagandı'],
  },
  {
    code: 'KW',
    name: 'Kuveyt',
    cities: ['Kuveyt Şehri', 'Salmiya', 'Hawalli'],
  },
  {
    code: 'NO',
    name: 'Norveç',
    cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  },
  {
    code: 'AT',
    name: 'Avusturya',
    cities: ['Viyana', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  },
  {
    code: 'PL',
    name: 'Polonya',
    cities: ['Varşova', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk'],
  },
  {
    code: 'PT',
    name: 'Portekiz',
    cities: ['Lizbon', 'Porto', 'Braga', 'Coimbra', 'Funchal'],
  },
  {
    code: 'RO',
    name: 'Romanya',
    cities: ['Bükreş', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța'],
  },
  {
    code: 'SA',
    name: 'Suudi Arabistan',
    cities: ['Riyad', 'Cidde', 'Mekke', 'Medine', 'Dammam'],
  },
  {
    code: 'GR',
    name: 'Yunanistan',
    cities: ['Atina', 'Selanik', 'Patras', 'Iraklion', 'Rhodes'],
  },
  {
    code: 'BG',
    name: 'Bulgaristan',
    cities: ['Sofya', 'Plovdiv', 'Varna', 'Burgaz', 'Ruse'],
  },
  {
    code: 'HR',
    name: 'Hırvatistan',
    cities: ['Zagreb', 'Split', 'Rijeka', 'Dubrovnik', 'Zadar'],
  },
  {
    code: 'AU',
    name: 'Avustralya',
    cities: ['Sidney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
  },
];
