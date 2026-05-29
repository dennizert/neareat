'use strict';

/**
 * seed-social-test.js
 *
 * Hedef:
 *   1. Ana kullanıcının (denniz.ertekin@gmail.com) profil mutfak seçimini ayarla.
 *   2. Ana kullanıcıya 4 koleksiyon (her biri 7 restoran) oluştur.
 *   3. Ana kullanıcıya en az 10 Ankara restoranı yorumu ekle.
 *   4. 20 YENİ test kullanıcısı oluştur — ana kullanıcıyla arkadaş OLMADAN.
 *      (5 tanesi Mehmet Akif Ersoy Mah., Yenimahalle/Ankara)
 *   5. Bu 20 kullanıcı kendi aralarında arkadaş olsun.
 *   6. Hepsine en az 10 restoran yorumu + 7 favori ekle.
 *   7. Tüm test kullanıcı giriş bilgilerini ekrana bas.
 *
 * Çalıştır:
 *   cd neareat-backend && node prisma/seed-social-test.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const MAIN_USER_EMAIL = 'denniz.ertekin@gmail.com';
const TEST_PASSWORD = 'Test1234!';

// ─── Ankara Restoranları (aynı liste, seed-users.js ile uyumlu) ───────────────

const RESTAURANTS = [
  { id: 'ankr_r01', name: 'Köşebaşı Ocakbaşı',          address: 'Tunalı Hilmi Cad. No:105, Çankaya/Ankara',   lat: 39.9125, lng: 32.8543, rating: 4.5 },
  { id: 'ankr_r02', name: 'Trilye Restaurant',            address: 'Köroğlu Cad. No:28, Çankaya/Ankara',         lat: 39.9098, lng: 32.8612, rating: 4.3 },
  { id: 'ankr_r03', name: 'Hacıbaba Restaurant',          address: 'İzmir Cad. No:14, Kızılay/Ankara',           lat: 39.9201, lng: 32.8545, rating: 4.1 },
  { id: 'ankr_r04', name: 'Buhara Restaurant',            address: 'Atatürk Bul. No:89, Kavaklıdere/Ankara',     lat: 39.9089, lng: 32.8598, rating: 4.2 },
  { id: 'ankr_r05', name: 'Kınacızade Pide Salonu',       address: 'Denizciler Cad. No:23, Ulus/Ankara',         lat: 39.9378, lng: 32.8594, rating: 3.9 },
  { id: 'ankr_r06', name: 'Manzara Restaurant',           address: 'Kuğulu Park Yanı, Çankaya/Ankara',           lat: 39.9061, lng: 32.8634, rating: 4.4 },
  { id: 'ankr_r07', name: 'Park Fora Restaurant',         address: 'Milli Müdafaa Cad. No:42, Kızılay/Ankara',   lat: 39.9212, lng: 32.8534, rating: 4.0 },
  { id: 'ankr_r08', name: 'Başkent Ocakbaşı',             address: 'Cemal Gürsel Cad. No:67, Keçiören/Ankara',   lat: 39.9678, lng: 32.8789, rating: 4.3 },
  { id: 'ankr_r09', name: 'Ankara Mutfağı',               address: 'Ziya Gökalp Cad. No:34, Kolej/Ankara',       lat: 39.9143, lng: 32.8609, rating: 4.1 },
  { id: 'ankr_r10', name: 'Sushi Ankara',                 address: 'Arjantin Cad. No:18, Gaziosmanpaşa/Ankara',  lat: 39.9112, lng: 32.8556, rating: 4.2 },
  { id: 'ankr_r11', name: 'Güveç Evi',                   address: 'Bayındır Sokak No:12, Kızılay/Ankara',       lat: 39.9189, lng: 32.8521, rating: 3.8 },
  { id: 'ankr_r12', name: 'Kavak Altı Restoranı',         address: 'Çubuk Yolu Üzeri, Pursaklar/Ankara',         lat: 40.0234, lng: 33.0123, rating: 4.6 },
  { id: 'ankr_r13', name: 'Can Döner',                    address: 'Sakarya Cad. No:8, Yenimahalle/Ankara',      lat: 39.9567, lng: 32.8345, rating: 3.7 },
  { id: 'ankr_r14', name: 'Kebapçı Halil',                address: 'Ulus Meydanı No:3, Altındağ/Ankara',         lat: 39.9371, lng: 32.8591, rating: 4.0 },
  { id: 'ankr_r15', name: 'Lezzet Durağı',                address: 'Çiçek Sokak No:5, Bahçelievler/Ankara',      lat: 39.8989, lng: 32.8241, rating: 3.9 },
  { id: 'ankr_r16', name: 'Nişantaşı Cafe & Restaurant',  address: 'Küçükesat Mah. No:11, Çankaya/Ankara',       lat: 39.9021, lng: 32.8512, rating: 4.3 },
  { id: 'ankr_r17', name: 'Sofra-i Cedid',                address: 'Kızılırmak Cad. No:45, Söğütözü/Ankara',    lat: 39.9234, lng: 32.8234, rating: 4.1 },
  { id: 'ankr_r18', name: 'Gönlüfethin Restaurant',       address: 'Hürriyet Cad. No:72, Sincan/Ankara',         lat: 39.9789, lng: 32.5812, rating: 3.8 },
  { id: 'ankr_r19', name: 'Mantıcı Ahmet Usta',           address: 'Mithatpaşa Cad. No:28, Kızılay/Ankara',      lat: 39.9198, lng: 32.8567, rating: 4.2 },
  { id: 'ankr_r20', name: 'Pide Merkezi',                 address: 'Opera Meydanı Yanı, Ulus/Ankara',            lat: 39.9356, lng: 32.8601, rating: 3.6 },
  { id: 'ankr_r21', name: 'Brasserie Ankara',             address: 'Tunus Cad. No:15, Kavaklıdere/Ankara',       lat: 39.9089, lng: 32.8578, rating: 4.4 },
  { id: 'ankr_r22', name: 'Köy Sofrası',                  address: 'Gölbaşı Yolu No:12, Gölbaşı/Ankara',        lat: 39.7812, lng: 32.8012, rating: 4.5 },
  { id: 'ankr_r23', name: 'Balıkçı Bodrum Restaurant',    address: 'Kızılırmak Cad. No:89, Bakanlıklar/Ankara',  lat: 39.9234, lng: 32.8512, rating: 4.3 },
  { id: 'ankr_r24', name: 'Çiğdem Pastanesi Cafe',        address: 'Olgunlar Sokak No:4, Kızılay/Ankara',        lat: 39.9201, lng: 32.8534, rating: 4.1 },
  { id: 'ankr_r25', name: 'Kebab Dünyası',                address: 'Dışkapı Mah. No:56, Altındağ/Ankara',        lat: 39.9512, lng: 32.8678, rating: 3.7 },
  { id: 'ankr_r26', name: 'AOÇ Restaurant',               address: 'Mürted Mah., Yenimahalle/Ankara',            lat: 39.9678, lng: 32.7234, rating: 4.2 },
  { id: 'ankr_r27', name: 'Cafe Cadde',                   address: 'Hoşdere Cad. No:178, Çankaya/Ankara',        lat: 39.8956, lng: 32.8412, rating: 3.9 },
  { id: 'ankr_r28', name: 'Şehzade Kebap',                address: 'Atatürk Bul. No:234, Kızılay/Ankara',        lat: 39.9189, lng: 32.8556, rating: 4.0 },
  { id: 'ankr_r29', name: 'Bodrum Balık Evi',             address: 'Meşrutiyet Cad. No:34, Çankaya/Ankara',      lat: 39.9123, lng: 32.8534, rating: 4.3 },
  { id: 'ankr_r30', name: 'Yöresel Tatlar',               address: 'Hacettepe Kampüsü Yanı, Altındağ/Ankara',    lat: 39.9412, lng: 32.8634, rating: 3.8 },
];

// ─── Ana Kullanıcı Mutfak Seçimi ──────────────────────────────────────────────

const MAIN_USER_CUISINES = ['Türk Mutfağı', 'Akdeniz', 'İtalyan', 'Deniz Mahsulleri', 'Kebap'];

// ─── Ana Kullanıcı Koleksiyonları (4 adet, 7'şer restoran) ──────────────────

const MAIN_COLLECTIONS = [
  {
    name: "Ankara'nın En İyileri",
    description: "Ankara'da mutlaka gidilmesi gereken, hiç hayal kırıklığı yaratmayan mekanlar",
    isPublic: true,
    // r01, r06, r09, r14, r22, r23, r29
    restaurantIndices: [0, 5, 8, 13, 21, 22, 28],
  },
  {
    name: 'Hafta Sonu Favorileri',
    description: 'Ailece ya da arkadaşlarla hafta sonu çıkışları için en keyifli yerler',
    isPublic: true,
    // r02, r04, r07, r12, r16, r24, r27
    restaurantIndices: [1, 3, 6, 11, 15, 23, 26],
  },
  {
    name: 'İş Yemeği Mekanları',
    description: 'Toplantı ve iş yemekleri için ortam ve kalite garantili restoranlar',
    isPublic: false,
    // r05, r08, r10, r17, r20, r25, r28
    restaurantIndices: [4, 7, 9, 16, 19, 24, 27],
  },
  {
    name: 'Ankara Deniz Ürünleri',
    description: "Ankara'da bile iyi deniz ürünleri bulunur — işte kanıtı",
    isPublic: true,
    // r03, r11, r18, r21, r23, r26, r30
    restaurantIndices: [2, 10, 17, 20, 22, 25, 29],
  },
];

// ─── 20 Yeni Test Kullanıcısı (Ana kullanıcıyla arkadaş OLMAYACAK) ────────────
// İlk 5 → Mehmet Akif Ersoy Mah., Yenimahalle/Ankara
// Kalan 15 → Ankara'nın çeşitli mahalleleri

const NEW_TEST_USERS = [
  // ──────────────────────────────────────────────────────────────────────────
  // Mehmet Akif Ersoy Mah., Yenimahalle (5 kişi)
  // ──────────────────────────────────────────────────────────────────────────
  {
    email: 'caner.simsek@neareat-test2.com',
    displayName: 'Caner Şimşek',
    bio: "Mehmet Akif Ersoy Mahallesi'nde yaşıyorum. Yenimahalle'nin her köşesindeki restoranları keşfediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Pide', 'Akdeniz'],
  },
  {
    email: 'neslihan.yurt@neareat-test2.com',
    displayName: 'Neslihan Yurt',
    bio: "Yenimahalle Mehmet Akif Ersoy sakiniyim, eşimle birlikte mahalle restoranlarını keşfediyoruz.",
    city: 'Ankara',
    favoriteCuisines: ['Akdeniz', 'İtalyan', 'Türk Mutfağı', 'Deniz Mahsulleri'],
  },
  {
    email: 'berk.toprak@neareat-test2.com',
    displayName: 'Berk Toprak',
    bio: "Mehmet Akif Ersoy Mah.'de oturan bir mühendisim. AOÇ çevresini ve Yenimahalle lokantalarını çok severim.",
    city: 'Ankara',
    favoriteCuisines: ['Et & Izgara', 'Kebap', 'Türk Mutfağı', 'Akdeniz'],
  },
  {
    email: 'tugce.ercan@neareat-test2.com',
    displayName: 'Tuğçe Ercan',
    bio: "Ankara doğumluyum, Yenimahalle'de büyüdüm. Lokalin tadını bilen biriyim.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Vejeteryan', 'Akdeniz', 'İtalyan'],
  },
  {
    email: 'mert.kaplan@neareat-test2.com',
    displayName: 'Mert Kaplan',
    bio: "Yenimahalle Mehmet Akif Ersoy'da yaşayan bir yazılımcıyım. Akşam çıkışı yemek en büyük hobim.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Pizza', 'Hamburger', 'Japon'],
  },
  // ──────────────────────────────────────────────────────────────────────────
  // Diğer Ankara mahalleleri (15 kişi) — çeşitli mutfak tercihleri
  // ──────────────────────────────────────────────────────────────────────────
  {
    email: 'arda.bulut@neareat-test2.com',
    displayName: 'Arda Bulut',
    bio: "Çankaya'da yaşıyorum, şehrin her köşesindeki restoranları deniyorum.",
    city: 'Ankara',
    favoriteCuisines: ['İtalyan', 'Akdeniz', 'Fransız', 'Deniz Mahsulleri'],
  },
  {
    email: 'pinar.uysal@neareat-test2.com',
    displayName: 'Pınar Uysal',
    bio: "Kızılay'da çalışan bir grafik tasarımcıyım. Öğle molalarımı güzel restoranlarla süslüyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Akdeniz', 'Vejeteryan', 'Türk Mutfağı', 'İtalyan'],
  },
  {
    email: 'kerem.arslan@neareat-test2.com',
    displayName: 'Kerem Arslan',
    bio: "Etlik'te yaşıyorum ama yemek için şehrin her tarafına gidebilirim.",
    city: 'Ankara',
    favoriteCuisines: ['Et & Izgara', 'Kebap', 'Türk Mutfağı', 'Pizza'],
  },
  {
    email: 'seda.ozcan@neareat-test2.com',
    displayName: 'Seda Özcan',
    bio: "Mamak'ta öğretmenim, yemek blogu yazıyorum. Ankara'nın gizli mekanlarını keşfediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Pide', 'Kebap', 'Akdeniz'],
  },
  {
    email: 'volkan.celik@neareat-test2.com',
    displayName: 'Volkan Çelik',
    bio: "Sincan'da yaşıyorum. Uzaktan çalışıyorum, öğle yemeği maceralarımı seçiyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Döner', 'Pide'],
  },
  {
    email: 'asli.demir@neareat-test2.com',
    displayName: 'Aslı Demir',
    bio: "Bahçelievler'de yaşayan bir avukatım. Yemekte hem lezzet hem kalite ararım.",
    city: 'Ankara',
    favoriteCuisines: ['Fransız', 'İtalyan', 'Akdeniz', 'Türk Mutfağı'],
  },
  {
    email: 'baris.yildiz@neareat-test2.com',
    displayName: 'Barış Yıldız',
    bio: "Keçiören'de bir eczacıyım. Sağlıklı ve lezzetli yemekleri bir arada ararım.",
    city: 'Ankara',
    favoriteCuisines: ['Vejeteryan', 'Akdeniz', 'Hint', 'Türk Mutfağı'],
  },
  {
    email: 'ezgi.koc@neareat-test2.com',
    displayName: 'Ezgi Koç',
    bio: "Gazi Üniversitesi'nde okuyan bir öğrenciyim. Bütçe dostu ama lezzetli yerler arıyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Pizza', 'Hamburger', 'Türk Mutfağı', 'Döner'],
  },
  {
    email: 'sercan.aydin@neareat-test2.com',
    displayName: 'Sercan Aydın',
    bio: "Pursaklar'dan Ankara'ya gelip gidiyorum. Şehir merkezindeki özel mekanları seviyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Akdeniz', 'İtalyan', 'Kebap'],
  },
  {
    email: 'cansu.polat@neareat-test2.com',
    displayName: 'Cansu Polat',
    bio: "Altındağ'da yaşayan bir müzisyenim. Konser sonrası açık olan restoranlar favorim.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Pizza', 'Kebap', 'Akdeniz'],
  },
  {
    email: 'firat.sahin@neareat-test2.com',
    displayName: 'Fırat Şahin',
    bio: "Etimesgut'ta bir mühendisim. Aile yemekleri ve hafta sonu keyifleri için en iyilerini biliyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Et & Izgara', 'Türk Mutfağı', 'Akdeniz', 'İtalyan'],
  },
  {
    email: 'hande.kurt@neareat-test2.com',
    displayName: 'Hande Kurt',
    bio: "Eryaman'da yaşıyorum. Anadolu'nun zengin mutfak kültürünü keşfetmeye devam ediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Akdeniz', 'Deniz Mahsulleri', 'Kebap'],
  },
  {
    email: 'tolga.sen@neareat-test2.com',
    displayName: 'Tolga Şen',
    bio: "Dikmen'de oturan bir fotoğraf sanatçısıyım. Estetik mekanlarda lezzetli yemekler ararım.",
    city: 'Ankara',
    favoriteCuisines: ['Fransız', 'İtalyan', 'Akdeniz', 'Deniz Mahsulleri'],
  },
  {
    email: 'irem.ayhan@neareat-test2.com',
    displayName: 'İrem Ayhan',
    bio: "Gölbaşı'nda yaşıyorum, şehre her gelişimde yeni bir restoran deniyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Akdeniz', 'İtalyan', 'Vejeteryan'],
  },
  {
    email: 'umut.kaya@neareat-test2.com',
    displayName: 'Umut Kaya',
    bio: "Ostim'de çalışıyorum. İş yerinden çıkınca lezzetli bir yemek beni rahatlıyor.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Pide', 'Et & Izgara'],
  },
];

// ─── Yorum şablonları ─────────────────────────────────────────────────────────

const POSITIVE_REVIEWS = [
  (n) => `${n} gerçekten Ankara'nın en iyilerinden! Yemekler tazeydi, servis hızlı ve personel güleryüzlüydü.`,
  (n) => `${n}'a arkadaşım önerdi ve çok iyi bir seçim oldu. Lezzetler mükemmeldi, porsiyon bolluğu da takdiri hak ediyor.`,
  (n) => `Fiyat-kalite dengesi açısından ${n} çok başarılı. Her şey tazeydi ve masaya sıcak geldi.`,
  (n) => `${n}'da harika bir akşam yemeği yedim. Mekanın ambiyansı çok hoş, yemekler de son derece lezzetliydi.`,
  (n) => `Ankara'da uzun süredir böyle kaliteli bir deneyim yaşamamıştım. ${n} beklentilerimi fazlasıyla karşıladı.`,
  (n) => `${n} için uzaktan gelmeye değer. Özellikle imza yemeklerini kesinlikle denemelisiniz.`,
  (n) => `${n}'da arkadaşlarımla çok keyifli bir öğle yemeği geçirdik. Herkes memnun ayrıldı!`,
];

const NEGATIVE_REVIEWS = [
  (n) => `${n} hakkındaki olumlu yorumları hak etmiyor maalesef. Bekleme süresi çok uzun ve yemekler soğuk geldi.`,
  (n) => `${n}'da yaşadığım deneyim hayal kırıklığıyla sonuçlandı. Fiyatlar yüksek ama kalite yok.`,
];

const MEDIUM_REVIEWS = [
  (n) => `${n} ortalama bir yer. Yemekler fena değil ama özellikle de çok iyi değil. Bir kez daha deneyeyim.`,
  (n) => `${n}'da yemekler idare ederdi ama fiyatlar biraz yüksek geldi.`,
];

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Kullanıcı i için 10 restoran indeksi — yeni kullanıcılar için farklı offset
function getNewUserRestaurantIndices(userIndex, count = 10) {
  // step=7, offset=5 → seed-users.js step=3 ile çakışmaz
  const indices = new Set();
  let i = 0;
  let cursor = (userIndex * 11 + 5) % RESTAURANTS.length;
  while (indices.size < count) {
    indices.add(cursor);
    cursor = (cursor + 7) % RESTAURANTS.length;
    i++;
    if (i > 100) break; // guard
  }
  return [...indices];
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

async function main() {
  console.log('==================================================');
  console.log('NearEat — Sosyal Test Seed (seed-social-test.js)');
  console.log('==================================================\n');

  // ── 1. Ana kullanıcıyı bul ve profil mutfak seçimini güncelle ──────────────
  console.log('[1/7] Ana kullanıcı profili güncelleniyor...');

  const mainUser = await prisma.user.findUnique({ where: { email: MAIN_USER_EMAIL } });
  if (!mainUser) {
    console.error(`HATA: ${MAIN_USER_EMAIL} bulunamadı. Devam edilemiyor.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: mainUser.id },
    data: {
      city: 'Ankara',
      bio: "Mehmet Akif Ersoy Mahallesi, Yenimahalle/Ankara'da yaşıyorum. Türk mutfağı ve Akdeniz lezzetleri favorim.",
      favoriteCuisines: MAIN_USER_CUISINES,
      shareWithFriendsRecommender: true,
      isPublic: true,
    },
  });
  console.log(`  ✓ Profil güncellendi. Mutfaklar: ${MAIN_USER_CUISINES.join(', ')}`);

  // ── 2. Ana kullanıcı için eksik yorumları tamamla (en az 10) ───────────────
  console.log('\n[2/7] Ana kullanıcı yorumları kontrol ediliyor...');

  const existingReviews = await prisma.review.findMany({
    where: { userId: mainUser.id },
    select: { placeId: true },
  });
  const reviewedPlaceIds = new Set(existingReviews.map((r) => r.placeId));
  console.log(`  Mevcut yorum sayısı: ${reviewedPlaceIds.size}`);

  const MAIN_REVIEW_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14];
  const mainReviewsToAdd = [];

  for (let i = 0; i < MAIN_REVIEW_INDICES.length; i++) {
    const r = RESTAURANTS[MAIN_REVIEW_INDICES[i]];
    if (reviewedPlaceIds.has(r.id)) continue;
    const rating = i < 10 ? randomInt(4, 5) : randomInt(1, 2);
    const templates = rating >= 4 ? POSITIVE_REVIEWS : NEGATIVE_REVIEWS;
    mainReviewsToAdd.push({
      userId: mainUser.id,
      placeId: r.id,
      rating,
      body: randomItem(templates)(r.name),
    });
  }

  if (mainReviewsToAdd.length > 0) {
    const res = await prisma.review.createMany({ data: mainReviewsToAdd, skipDuplicates: true });
    console.log(`  ✓ ${res.count} yeni yorum eklendi (toplam ≥ ${reviewedPlaceIds.size + res.count}).`);
  } else {
    console.log(`  ✓ Zaten yeterli yorum var (${reviewedPlaceIds.size} adet), atlıyor.`);
  }

  // ── 3. Ana kullanıcı için koleksiyonlar ────────────────────────────────────
  console.log('\n[3/7] Ana kullanıcı koleksiyonları oluşturuluyor...');

  let collectionCount = 0;
  for (const colDef of MAIN_COLLECTIONS) {
    // Aynı isimde koleksiyon varsa atla
    const existing = await prisma.collection.findFirst({
      where: { userId: mainUser.id, name: colDef.name },
    });
    if (existing) {
      console.log(`  ↷ "${colDef.name}" zaten var, atlanıyor.`);
      continue;
    }

    const col = await prisma.collection.create({
      data: {
        userId: mainUser.id,
        name: colDef.name,
        description: colDef.description,
        isPublic: colDef.isPublic,
      },
    });

    const items = colDef.restaurantIndices.map((rIdx) => {
      const r = RESTAURANTS[rIdx];
      return {
        collectionId: col.id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
      };
    });

    await prisma.collectionItem.createMany({ data: items, skipDuplicates: true });
    collectionCount++;
    console.log(`  ✓ "${colDef.name}" — ${items.length} restoran (${colDef.isPublic ? 'herkese açık' : 'özel'})`);
  }
  if (collectionCount === 0) console.log('  Tüm koleksiyonlar zaten mevcuttu.');

  // ── 4. 20 Yeni test kullanıcısı oluştur ────────────────────────────────────
  console.log('\n[4/7] 20 yeni test kullanıcısı oluşturuluyor...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const newUsers = [];

  for (const data of NEW_TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        displayName: data.displayName,
        bio: data.bio,
        city: data.city,
        favoriteCuisines: data.favoriteCuisines,
        isPublic: true,
        emailVerified: true,
        shareWithFriendsRecommender: true,
      },
      create: {
        email: data.email,
        displayName: data.displayName,
        passwordHash,
        authProvider: 'email',
        bio: data.bio,
        city: data.city,
        favoriteCuisines: data.favoriteCuisines,
        isPublic: true,
        emailVerified: true,
        shareWithFriendsRecommender: true,
      },
    });
    newUsers.push(user);
    process.stdout.write('.');
  }
  console.log(`\n  ✓ ${newUsers.length} kullanıcı oluşturuldu/güncellendi.`);
  console.log('  ✗ Ana kullanıcıyla arkadaşlık kurulmadı (bilerek).');

  // ── 5. Yeni kullanıcılar kendi aralarında arkadaş olsun ────────────────────
  console.log('\n[5/7] Yeni kullanıcılar arasında arkadaşlık kuruluyor...');

  const friendPairs = [];
  for (let i = 0; i < newUsers.length; i++) {
    for (let j = i + 1; j < newUsers.length; j++) {
      friendPairs.push({
        fromUserId: newUsers[i].id,
        toUserId: newUsers[j].id,
        status: 'ACCEPTED',
      });
    }
  }

  const friendResult = await prisma.friendRequest.createMany({
    data: friendPairs,
    skipDuplicates: true,
  });
  console.log(`  ✓ ${friendResult.count} arkadaşlık ilişkisi oluşturuldu (hedef: ${friendPairs.length}).`);

  // ── 6. Yeni kullanıcılar için yorumlar (her biri 10 restoran) ──────────────
  console.log('\n[6/7] Yeni kullanıcı yorumları ve favorileri oluşturuluyor...');

  const reviewsToCreate = [];
  const favoritesToCreate = [];

  for (let i = 0; i < newUsers.length; i++) {
    const user = newUsers[i];
    const rIndices = getNewUserRestaurantIndices(i, 10);

    for (let k = 0; k < rIndices.length; k++) {
      const r = RESTAURANTS[rIndices[k]];
      let rating, body;
      if (k >= 8) {
        rating = randomInt(1, 2);
        body = randomItem(NEGATIVE_REVIEWS)(r.name);
      } else if (k >= 6) {
        rating = 3;
        body = randomItem(MEDIUM_REVIEWS)(r.name);
      } else {
        rating = randomInt(4, 5);
        body = randomItem(POSITIVE_REVIEWS)(r.name);
      }
      reviewsToCreate.push({ userId: user.id, placeId: r.id, rating, body });
    }

    // 7 favori (ilk 7 restoran indeksinden)
    const favIndices = rIndices.slice(0, 7);
    for (const rIdx of favIndices) {
      const r = RESTAURANTS[rIdx];
      favoritesToCreate.push({
        userId: user.id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeLat: r.lat,
        placeLng: r.lng,
        placeRating: r.rating,
      });
    }
  }

  const reviewResult = await prisma.review.createMany({ data: reviewsToCreate, skipDuplicates: true });
  const favResult   = await prisma.favorite.createMany({ data: favoritesToCreate, skipDuplicates: true });
  console.log(`  ✓ ${reviewResult.count} yorum oluşturuldu (10/kullanıcı).`);
  console.log(`  ✓ ${favResult.count} favori oluşturuldu (7/kullanıcı).`);

  // ── 7. Yıldız puanlarını güncelle ──────────────────────────────────────────
  console.log('\n[7/7] Yıldız puanları ayarlanıyor...');
  const NEW_USER_STARS = 85; // 10×5 + (19 arkadaş)×1 + 0 öneri

  await prisma.user.updateMany({
    where: { id: { in: newUsers.map((u) => u.id) } },
    data: { starCount: NEW_USER_STARS },
  });

  const starEvents = newUsers.flatMap((u) => [
    { userId: u.id, type: 'REVIEW',       amount: 50, description: '10 restoran yorumu (seed)' },
    { userId: u.id, type: 'FRIEND_ADDED', amount: 19, description: '19 arkadaşlık (seed)' },
  ]);
  await prisma.starEvent.createMany({ data: starEvents });
  console.log(`  ✓ ${newUsers.length} kullanıcıya ${NEW_USER_STARS} yıldız verildi.`);

  // ── Özet ───────────────────────────────────────────────────────────────────
  console.log('\n==================================================');
  console.log('TAMAMLANDI!');
  console.log('==================================================');
  console.log(`  Koleksiyonlar  : ${collectionCount} yeni (ana kullanıcı)`);
  console.log(`  Yeni kullanıcı : ${newUsers.length}`);
  console.log(`  Arkadaşlık     : ${friendResult.count} (yeni kullanıcılar arası, ana hariç)`);
  console.log(`  Yorum          : ${reviewResult.count}`);
  console.log(`  Favori         : ${favResult.count}`);

  // ── GİRİŞ BİLGİLERİ ───────────────────────────────────────────────────────
  console.log('\n==================================================');
  console.log('TÜM TEST KULLANICI GİRİŞ BİLGİLERİ');
  console.log('==================================================');

  console.log('\n--- MEVCUT TEST KULLANICILARI (seed-users.js — Ana kullanıcıyla ARKADAŞ) ---');
  const oldUsers = [
    { displayName: 'Ahmet Yılmaz',   email: 'ahmet.yilmaz@neareat-test.com' },
    { displayName: 'Ayşe Kaya',      email: 'ayse.kaya@neareat-test.com' },
    { displayName: 'Mehmet Demir',   email: 'mehmet.demir@neareat-test.com' },
    { displayName: 'Fatma Şahin',    email: 'fatma.sahin@neareat-test.com' },
    { displayName: 'Ali Çelik',      email: 'ali.celik@neareat-test.com' },
    { displayName: 'Zeynep Arslan',  email: 'zeynep.arslan@neareat-test.com' },
    { displayName: 'Mustafa Öztürk', email: 'mustafa.ozturk@neareat-test.com' },
    { displayName: 'Elif Yıldız',    email: 'elif.yildiz@neareat-test.com' },
    { displayName: 'Ibrahim Dogan',  email: 'ibrahim.dogan@neareat-test.com' },
    { displayName: 'Sevgi Kılıç',    email: 'sevgi.kilic@neareat-test.com' },
    { displayName: 'Hasan Aktaş',    email: 'hasan.aktas@neareat-test.com' },
    { displayName: 'Merve Korkmaz',  email: 'merve.korkmaz@neareat-test.com' },
    { displayName: 'Emre Erdogan',   email: 'emre.erdogan@neareat-test.com' },
    { displayName: 'Selin Çakır',    email: 'selin.cakir@neareat-test.com' },
    { displayName: 'Burak Simsek',   email: 'burak.simsek@neareat-test.com' },
    { displayName: 'Derya Ozdemir',  email: 'derya.ozdemir@neareat-test.com' },
    { displayName: 'Oguz Aydin',     email: 'oguz.aydin@neareat-test.com' },
    { displayName: 'Deniz Yalcin',   email: 'deniz.yalcin@neareat-test.com' },
    { displayName: 'Kaan Aslan',     email: 'kaan.aslan@neareat-test.com' },
    { displayName: 'Gizem Gunes',    email: 'gizem.gunes@neareat-test.com' },
  ];
  oldUsers.forEach((u, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${u.displayName.padEnd(20)} | ${u.email.padEnd(38)} | ${TEST_PASSWORD}`);
  });

  console.log('\n--- YENİ TEST KULLANICILARI (seed-social-test.js — Ana kullanıcıyla ARKADAŞ DEĞİL) ---');
  console.log('  İlk 5 → Mehmet Akif Ersoy Mah., Yenimahalle/Ankara');
  newUsers.forEach((u, i) => {
    const data = NEW_TEST_USERS[i];
    const neighborhood = i < 5 ? '📍 Yenimahalle' : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${data.displayName.padEnd(20)} | ${data.email.padEnd(42)} | ${TEST_PASSWORD}  ${neighborhood}`);
  });

  console.log('\n  Şifre (tüm test kullanıcıları için aynı): ' + TEST_PASSWORD);
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error('\nHATA:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
