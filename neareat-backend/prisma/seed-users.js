'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const MAIN_USER_EMAIL = 'denniz.ertekin@gmail.com';

// ─── Ankara Restoranları (30 adet) ───────────────────────────────────────────

const RESTAURANTS = [
  { id: 'ankr_r01', name: 'Köşebaşı Ocakbaşı', address: 'Tunalı Hilmi Cad. No:105, Çankaya/Ankara', lat: 39.9125, lng: 32.8543, rating: 4.5 },
  { id: 'ankr_r02', name: 'Trilye Restaurant', address: 'Köroğlu Cad. No:28, Çankaya/Ankara', lat: 39.9098, lng: 32.8612, rating: 4.3 },
  { id: 'ankr_r03', name: 'Hacıbaba Restaurant', address: 'İzmir Cad. No:14, Kızılay/Ankara', lat: 39.9201, lng: 32.8545, rating: 4.1 },
  { id: 'ankr_r04', name: 'Buhara Restaurant', address: 'Atatürk Bul. No:89, Kavaklıdere/Ankara', lat: 39.9089, lng: 32.8598, rating: 4.2 },
  { id: 'ankr_r05', name: 'Kınacızade Pide Salonu', address: 'Denizciler Cad. No:23, Ulus/Ankara', lat: 39.9378, lng: 32.8594, rating: 3.9 },
  { id: 'ankr_r06', name: 'Manzara Restaurant', address: 'Kuğulu Park Yanı, Çankaya/Ankara', lat: 39.9061, lng: 32.8634, rating: 4.4 },
  { id: 'ankr_r07', name: 'Park Fora Restaurant', address: 'Milli Müdafaa Cad. No:42, Kızılay/Ankara', lat: 39.9212, lng: 32.8534, rating: 4.0 },
  { id: 'ankr_r08', name: 'Başkent Ocakbaşı', address: 'Cemal Gürsel Cad. No:67, Keçiören/Ankara', lat: 39.9678, lng: 32.8789, rating: 4.3 },
  { id: 'ankr_r09', name: 'Ankara Mutfağı', address: 'Ziya Gökalp Cad. No:34, Kolej/Ankara', lat: 39.9143, lng: 32.8609, rating: 4.1 },
  { id: 'ankr_r10', name: 'Sushi Ankara', address: 'Arjantin Cad. No:18, Gaziosmanpaşa/Ankara', lat: 39.9112, lng: 32.8556, rating: 4.2 },
  { id: 'ankr_r11', name: 'Güveç Evi', address: 'Bayındır Sokak No:12, Kızılay/Ankara', lat: 39.9189, lng: 32.8521, rating: 3.8 },
  { id: 'ankr_r12', name: 'Kavak Altı Restoranı', address: 'Çubuk Yolu Üzeri, Pursaklar/Ankara', lat: 40.0234, lng: 33.0123, rating: 4.6 },
  { id: 'ankr_r13', name: 'Can Döner', address: 'Sakarya Cad. No:8, Yenimahalle/Ankara', lat: 39.9567, lng: 32.8345, rating: 3.7 },
  { id: 'ankr_r14', name: 'Kebapçı Halil', address: 'Ulus Meydanı No:3, Altındağ/Ankara', lat: 39.9371, lng: 32.8591, rating: 4.0 },
  { id: 'ankr_r15', name: 'Lezzet Durağı', address: 'Çiçek Sokak No:5, Bahçelievler/Ankara', lat: 39.8989, lng: 32.8241, rating: 3.9 },
  { id: 'ankr_r16', name: 'Nişantaşı Cafe & Restaurant', address: 'Küçükesat Mah. No:11, Çankaya/Ankara', lat: 39.9021, lng: 32.8512, rating: 4.3 },
  { id: 'ankr_r17', name: 'Sofra-i Cedid', address: 'Kızılırmak Cad. No:45, Söğütözü/Ankara', lat: 39.9234, lng: 32.8234, rating: 4.1 },
  { id: 'ankr_r18', name: 'Gönlüfethin Restaurant', address: 'Hürriyet Cad. No:72, Sincan/Ankara', lat: 39.9789, lng: 32.5812, rating: 3.8 },
  { id: 'ankr_r19', name: 'Mantıcı Ahmet Usta', address: 'Mithatpaşa Cad. No:28, Kızılay/Ankara', lat: 39.9198, lng: 32.8567, rating: 4.2 },
  { id: 'ankr_r20', name: 'Pide Merkezi', address: 'Opera Meydanı Yanı, Ulus/Ankara', lat: 39.9356, lng: 32.8601, rating: 3.6 },
  { id: 'ankr_r21', name: 'Brasserie Ankara', address: 'Tunus Cad. No:15, Kavaklıdere/Ankara', lat: 39.9089, lng: 32.8578, rating: 4.4 },
  { id: 'ankr_r22', name: 'Köy Sofrası', address: 'Gölbaşı Yolu No:12, Gölbaşı/Ankara', lat: 39.7812, lng: 32.8012, rating: 4.5 },
  { id: 'ankr_r23', name: 'Balıkçı Bodrum Restaurant', address: 'Kızılırmak Cad. No:89, Bakanlıklar/Ankara', lat: 39.9234, lng: 32.8512, rating: 4.3 },
  { id: 'ankr_r24', name: 'Çiğdem Pastanesi Cafe', address: 'Olgunlar Sokak No:4, Kızılay/Ankara', lat: 39.9201, lng: 32.8534, rating: 4.1 },
  { id: 'ankr_r25', name: 'Kebab Dünyası', address: 'Dışkapı Mah. No:56, Altındağ/Ankara', lat: 39.9512, lng: 32.8678, rating: 3.7 },
  { id: 'ankr_r26', name: 'AOÇ Restaurant', address: 'Mürted Mah., Yenimahalle/Ankara', lat: 39.9678, lng: 32.7234, rating: 4.2 },
  { id: 'ankr_r27', name: 'Cafe Cadde', address: 'Hoşdere Cad. No:178, Çankaya/Ankara', lat: 39.8956, lng: 32.8412, rating: 3.9 },
  { id: 'ankr_r28', name: 'Şehzade Kebap', address: 'Atatürk Bul. No:234, Kızılay/Ankara', lat: 39.9189, lng: 32.8556, rating: 4.0 },
  { id: 'ankr_r29', name: 'Bodrum Balık Evi', address: 'Meşrutiyet Cad. No:34, Çankaya/Ankara', lat: 39.9123, lng: 32.8534, rating: 4.3 },
  { id: 'ankr_r30', name: 'Yöresel Tatlar', address: 'Hacettepe Kampüsü Yanı, Altındağ/Ankara', lat: 39.9412, lng: 32.8634, rating: 3.8 },
];

// ─── Test Kullanıcıları (20 adet) ─────────────────────────────────────────────

const TEST_USER_DATA = [
  {
    email: 'ahmet.yilmaz@neareat-test.com',
    displayName: 'Ahmet Yılmaz',
    bio: "Ankara'da yazılım mühendisiyim. Her hafta yeni bir restoran keşfetmeyi seviyorum. Özellikle Türk mutfağı ve et yemeklerine bayılırım.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Et & Izgara', 'Akdeniz'],
  },
  {
    email: 'ayse.kaya@neareat-test.com',
    displayName: 'Ayşe Kaya',
    bio: "Gıda blogcusu ve yemek tutkunuyum. Ankara'nın gizli restoran hazinelerini keşfediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['İtalyan', 'Pizza', 'Fransız', 'Akdeniz', 'Deniz Mahsulleri'],
  },
  {
    email: 'mehmet.demir@neareat-test.com',
    displayName: 'Mehmet Demir',
    bio: "Gastronomi meraklısı ve amatör şefim. Ankara'da lezzetli yemekler bulmak benim hobim.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Et & Izgara', 'Pide'],
  },
  {
    email: 'fatma.sahin@neareat-test.com',
    displayName: 'Fatma Şahin',
    bio: "Öğretmenim ve yemek sevdalısıyım. Arkadaşlarımla yeni mekanlar keşfetmekten keyif alıyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Vejeteryan', 'Akdeniz', 'Çin'],
  },
  {
    email: 'ali.celik@neareat-test.com',
    displayName: 'Ali Çelik',
    bio: "Ankara Üniversitesi'nde akademisyenim. Kaliteli yemek ve iyi arkadaşlık birleşince en güzel ortam oluyor.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'İtalyan', 'Japon', 'Sushi'],
  },
  {
    email: 'zeynep.arslan@neareat-test.com',
    displayName: 'Zeynep Arslan',
    bio: "Mimarım ve estetik mekanları çok seviyorum. Yemek deneyiminde hem lezzet hem ambiyans önemli benim için.",
    city: 'Ankara',
    favoriteCuisines: ['Fransız', 'İtalyan', 'Akdeniz', 'Deniz Mahsulleri'],
  },
  {
    email: 'mustafa.ozturk@neareat-test.com',
    displayName: 'Mustafa Öztürk',
    bio: "Avukatım, işten çıkınca en sevdiğim aktivite yeni mekanlar keşfetmek. Ankara'nın lezzet haritasını çıkarıyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Et & Izgara', 'Türk Mutfağı', 'Kebap', 'Pide'],
  },
  {
    email: 'elif.yildiz@neareat-test.com',
    displayName: 'Elif Yıldız',
    bio: "Doktorum ve sağlıklı beslenmeye önem veriyorum ama zaman zaman gurme deneyimler yaşamaktan da vazgeçemiyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Vejeteryan', 'Akdeniz', 'Türk Mutfağı', 'Hint'],
  },
  {
    email: 'ibrahim.dogan@neareat-test.com',
    displayName: 'Ibrahim Dogan',
    bio: "Fotoğraf sanatçısıyım ve yemek fotoğrafçılığı yapıyorum. Ankara'nın en güzel mekanlarını görüntülüyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Japon', 'Sushi', 'Çin', 'Türk Mutfağı'],
  },
  {
    email: 'sevgi.kilic@neareat-test.com',
    displayName: 'Sevgi Kılıç',
    bio: "Turizm sektöründe çalışıyorum ve yabancı mutfaklara çok meraklıyım. Her fırsatta yeni lezzetler deniyorum.",
    city: 'Ankara',
    favoriteCuisines: ['İtalyan', 'Fransız', 'Hint', 'Meksika', 'Japon'],
  },
  {
    email: 'hasan.aktas@neareat-test.com',
    displayName: 'Hasan Aktaş',
    bio: "Müzisyenim ve konser sonrası yemek yemeği çok seviyorum. Canlı müzikli mekanlar favorilerim.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Döner', 'Pizza'],
  },
  {
    email: 'merve.korkmaz@neareat-test.com',
    displayName: 'Merve Korkmaz',
    bio: "Pazarlama uzmanıyım ve sosyal medyada yemek içerikleri paylaşmayı seviyorum. Ankara'nın en trend mekanlarını takip ediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['İtalyan', 'Akdeniz', 'Türk Mutfağı', 'Vejeteryan', 'Pizza'],
  },
  {
    email: 'emre.erdogan@neareat-test.com',
    displayName: 'Emre Erdogan',
    bio: "Girişimciyim ve iş yemeklerinde kaliteli restoranlar çok önemli. Ankara'nın iş yemeği için en iyi mekanlarını biliyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Fransız', 'Akdeniz', 'Et & Izgara', 'İtalyan'],
  },
  {
    email: 'selin.cakir@neareat-test.com',
    displayName: 'Selin Çakır',
    bio: "Bankacıyım ve öğle yemeği maceraları benim günümü güzelleştiriyor. Her gün farklı bir restoran deniyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Pide', 'Mantı', 'Akdeniz'],
  },
  {
    email: 'burak.simsek@neareat-test.com',
    displayName: 'Burak Simsek',
    bio: "Spor hocasıyım ama fit kalmak için doğru yemeği seçmek de bir beceri. Sağlıklı ve lezzetli restoran kombinasyonunu arıyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Vejeteryan', 'Akdeniz', 'Türk Mutfağı', 'Hint'],
  },
  {
    email: 'derya.ozdemir@neareat-test.com',
    displayName: 'Derya Ozdemir',
    bio: "Psikologum ve insanların bir arada olduğu atmosferli mekanları çok seviyorum. Yemek hem beyin hem ruh gıdası.",
    city: 'Ankara',
    favoriteCuisines: ['Akdeniz', 'Fransız', 'İtalyan', 'Türk Mutfağı'],
  },
  {
    email: 'oguz.aydin@neareat-test.com',
    displayName: 'Oguz Aydin',
    bio: "Gazeteciyim ve şehir kültürünü anlamak için yerel restoranları çok önemli buluyorum. Her köşede bir hikaye var.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Kebap', 'Pide', 'Akdeniz'],
  },
  {
    email: 'deniz.yalcin@neareat-test.com',
    displayName: 'Deniz Yalcin',
    bio: "Deniz ürünleri tutkunuyum ama adım Deniz olduğu için şaka gibi. Ankara'da iyi balık yeri bulmak zor ama imkansız değil.",
    city: 'Ankara',
    favoriteCuisines: ['Deniz Mahsulleri', 'Akdeniz', 'İtalyan', 'Türk Mutfağı'],
  },
  {
    email: 'kaan.aslan@neareat-test.com',
    displayName: 'Kaan Aslan',
    bio: "Yazılım geliştiriciyim ve gece çalışmalarından sonra geç saate kadar açık olan restoranlar favorilerim.",
    city: 'Ankara',
    favoriteCuisines: ['Pizza', 'Hamburger', 'Türk Mutfağı', 'Japon'],
  },
  {
    email: 'gizem.gunes@neareat-test.com',
    displayName: 'Gizem Gunes',
    bio: "Sanat tarihçisiyim ve tarihi mekanlarda yemek yemeği çok severim. Ankara'nın tarihi semtlerindeki lokantaları keşfediyorum.",
    city: 'Ankara',
    favoriteCuisines: ['Türk Mutfağı', 'Akdeniz', 'İtalyan', 'Fransız'],
  },
];

// ─── Yorum Şablonları ─────────────────────────────────────────────────────────

const POSITIVE_REVIEWS = [
  (n) => `${n} gerçekten Ankara'nın en iyilerinden! Yemekler tazeydi, servis hızlı ve personel güleryüzlüydü. Mutlaka tekrar geleceğim.`,
  (n) => `${n}'a arkadaşım önerdi ve çok iyi bir seçim oldu. Lezzetler mükemmeldi, porsiyon bolluğu da takdiri hak ediyor.`,
  (n) => `Fiyat-kalite dengesi açısından ${n} çok başarılı. Her şey tazeydi ve masaya sıcak geldi. Harika bir deneyimdi.`,
  (n) => `${n}'da harika bir akşam yemeği yedim. Mekanın ambiyansı çok hoş, yemekler de son derece lezzetliydi.`,
  (n) => `Ankara'da uzun süredir böyle kaliteli bir deneyim yaşamamıştım. ${n} beklentilerimi fazlasıyla karşıladı.`,
  (n) => `${n} için uzaktan gelmeye değer. Özellikle imza yemeklerini kesinlikle denemelisiniz. Harika bir lezzet yolculuğu.`,
  (n) => `${n}'da arkadaşlarımla çok keyifli bir öğle yemeği geçirdik. Herkes çok memnun ayrıldı, şimdi biz de öneriyoruz!`,
];

const NEGATIVE_REVIEWS = [
  (n) => `${n} hakkındaki olumlu yorumları hak etmiyor maalesef. Bekleme süresi çok uzun ve yemekler soğuk geldi.`,
  (n) => `${n}'da yaşadığım deneyim hayal kırıklığıyla sonuçlandı. Fiyatlar yüksek ama kalite bunu hiç karşılamıyor.`,
  (n) => `${n}'a bir daha gitmem. Sipariş yanlış geldi ve özür bile dilenilmedi. Yönetim işin içinde değil gibi.`,
  (n) => `Temizlik konusunda ciddi sıkıntılar yaşadım. ${n} daha düzenli ve hijyenik bir ortam sunmalı. Hayal kırıklığı.`,
];

const MEDIUM_REVIEWS = [
  (n) => `${n} ortalama bir yer. Yemekler fena değil ama özellikle de çok iyi değil. Bir kez daha deneyeyim.`,
  (n) => `${n}'da yemekler idare ederdi ama fiyatlar biraz yüksek geldi. Daha makul fiyatlı seçenekler var şehirde.`,
  (n) => `${n}'ı farklı saatlerinde ziyaret ettim, kalite tutarsız. Bazen çok iyiydi, bazen hayal kırıklığıydı.`,
];

const MAIN_GOOD_REVIEWS = [
  (n) => `${n} çok beğendim. Ankara'da bu kadar kaliteli bir yer bulmak gerçekten zor. Özellikle imza lezzetleri harikaydı.`,
  (n) => `${n}'ı uzun süredir biliyorum ve her gelişte memnun ayrılıyorum. Standardı koruyan ender mekanlardan biri.`,
  (n) => `${n}'da çalışma arkadaşlarımla öğle yemeği yedik. Herkes çok memnun ayrıldı. Tekrar kesinlikle geleceğiz.`,
  (n) => `${n} için söyleyeceklerim sadece olumlu. Lezzetler otantik, servis kaliteli, ambiyans keyifli. Tam puan!`,
];

const MAIN_BAD_REVIEWS = [
  (n) => `${n} için yüksek beklentilerle geldim ama tam hayal kırıklığı yaşadım. Yemekler soğuk, servis ilgisiz.`,
  (n) => `${n}'nın kalitesi düşmüş kesinlikle. Eskiden iyiydi diye hep giderdim, artık aynı kalitede değil.`,
  (n) => `${n}'da sipariş aldıktan sonra 45 dakika bekledim. Yemek geldiğinde soğumuştu. Bir daha gitmem.`,
];

// ─── Mesaj ve Öneri Şablonları ────────────────────────────────────────────────

const MESSAGE_THREADS = [
  [
    'Selam! Bu restorana gittin mi hiç? Çok duyduk iyi olduğunu.',
    'Evet gittim geçen ay, gerçekten çok beğendim! Sen de mutlaka git.',
    'Tamam o zaman bu hafta sonu birlikte gidelim mi?',
    'Süper fikir! Cumartesi akşamı uygun musun?',
    'Cumartesi akşamı olur. Rezervasyon yapalım mı?',
  ],
  [
    'Merhaba, yeni bir restoran keşfettim Ankara\'da. Harika bir yer.',
    'Nerede bu restoran? Adres versene.',
    'Çankaya tarafında, Tunalı Hilmi yakınında. Çok lezzetli.',
    'Buraya gitmek istiyorum, ne zaman gidelim?',
    'Bu akşam uygunsa çıkalım, haber ver.',
  ],
  [
    'Bu hafta sonu nereye gidelim yemek için?',
    'Kebap canım çekiyor, Köşebaşı\'na gidelim mi?',
    'Köşebaşı çok güzel ama biraz pahalı, başka önerin var mı?',
    'Buhara Restaurant da çok iyidir, daha makul fiyatlı.',
    'Tamam Buhara diyelim o zaman, çok severim orayı.',
  ],
  [
    'Geçen haftaki yemeği çok beğendim, herkes memnun ayrıldı.',
    'Benim de çok hoşuma gitti, harika bir seçimdi.',
    'Bir dahaki sefere seni de çağıralım.',
    'Kesinlikle, beklerim. Hangi gün planlanıyor?',
    'Cuma akşamı mı sana uyar?',
  ],
  [
    'Ankara\'nın en iyi balık restoranını biliyor musun?',
    'Bodrum Balık Evi çok iyidir, Çankaya\'da.',
    'Gerçekten mi? Ne zaman gittin son?',
    'Geçen ay gittim, balık çok tazeydi ve lezzetliydi.',
    'Harika, yakında deneyeceğim. Teşekkürler!',
  ],
  [
    'Yeni açılan restoranı duydun mu? Herkes çok beğenmiş.',
    'Hangisi? Çok yeni yer açılıyor son zamanlarda.',
    'Brasserie Ankara, Kavaklıdere\'de. Fransız mutfağı yapıyor.',
    'Fransız mutfağı Ankara\'da ilginç. Denemek isterim.',
    'Birlikte gidelim o zaman, ben rezervasyon yaparım.',
  ],
  [
    'Öğle yemeği için bugün nereye gidiyorsun?',
    'Henüz karar vermedim, önerir misin bir yer?',
    'Mantıcı Ahmet Usta çok iyidir, Kızılay\'da.',
    'Mantı canım çekmişti zaten, oraya gidelim.',
    'Yarım saate kadar çıkıyorum, sen de gel.',
  ],
];

const REC_MESSAGES = [
  "Ankara'da mutlaka denemeni tavsiye ederim! Lezzetler çok kaliteli ve fiyatlar makul.",
  'Geçen hafta arkadaşlarla gittik, herkes çok beğendi. Seni de götürmek istedim.',
  'Biliyorum bu tarzı seviyorsun, tam sana göre bir yer!',
  'Özel bir akşam için harika bir tercih. Ambiyans ve yemekler mükemmel.',
  'Bu hafta sonu buraya gidelim mi? Uzun süredir gitmek istiyordum.',
  "Ankara'nın gizli bir hazinesi. Keşfetmenden mutlu olursun!",
  "Fiyat-kalite dengesi açısından Ankara'da bu kadar iyi başka bir yer bilmiyorum.",
  'Özellikle akşam gidilmeli, ambiyans çok farklı oluyor. Kesinlikle öneriyorum.',
];

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Kullanıcı i için 10 restoran indeksi (deterministic, her kullanıcı farklı)
function getUserRestaurantIndices(userIndex, count = 10) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push((userIndex + i * 3) % RESTAURANTS.length);
  }
  return result; // step=3, total=30 → 10 unique (GCD(3,30)=3, tam 10 unique çıkar)
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

async function main() {
  console.log('==================================================');
  console.log('NearEat Test Kullanicisi Seed Scripti');
  console.log('==================================================\n');

  // 1. Ana kullanıcıyı bul
  const mainUser = await prisma.user.findUnique({ where: { email: MAIN_USER_EMAIL } });
  if (!mainUser) {
    console.log(`UYARI: ${MAIN_USER_EMAIL} bulunamadi. Ana kullanici verileri atlanacak.\n`);
  } else {
    console.log(`Ana kullanici: ${mainUser.displayName} (id: ${mainUser.id})\n`);
  }

  // 2. Test kullanıcılarını oluştur/güncelle
  console.log('[1/8] Test kullanicilari olusturuluyor...');
  const passwordHash = await bcrypt.hash('Test1234!', 10);

  const testUsers = [];
  for (const data of TEST_USER_DATA) {
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
    testUsers.push(user);
    process.stdout.write('.');
  }
  console.log(`\n  ${testUsers.length} kullanici olusturuldu/guncellendi.`);

  // 3. Arkadaşlık ilişkileri kur
  console.log('\n[2/8] Arkadaslik iliskileri kuruluyor...');

  const friendPairs = [];

  // Tüm test kullanıcıları birbirleriyle (all-pairs: 20*19/2 = 190)
  for (let i = 0; i < testUsers.length; i++) {
    for (let j = i + 1; j < testUsers.length; j++) {
      friendPairs.push({
        fromUserId: testUsers[i].id,
        toUserId: testUsers[j].id,
        status: 'ACCEPTED',
      });
    }
  }

  // Tüm test kullanıcıları ana kullanıcıyla
  if (mainUser) {
    for (const u of testUsers) {
      friendPairs.push({
        fromUserId: u.id,
        toUserId: mainUser.id,
        status: 'ACCEPTED',
      });
    }
  }

  const friendResult = await prisma.friendRequest.createMany({
    data: friendPairs,
    skipDuplicates: true,
  });
  console.log(`  ${friendResult.count} arkadaslik iliskisi olusturuldu (toplam hedef: ${friendPairs.length}).`);

  // 4. Test kullanıcıları için yorumlar (her kullanıcı 10 restoran)
  console.log('\n[3/8] Test kullanicisi yorumlari olusturuluyor...');

  const testReviews = [];
  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const rIndices = getUserRestaurantIndices(i, 10);

    for (let k = 0; k < rIndices.length; k++) {
      const r = RESTAURANTS[rIndices[k]];
      let rating, body;

      if (k === 8 || k === 9) {
        // Son 2: olumsuz yorum (rating 1-2)
        rating = randomInt(1, 2);
        body = randomItem(NEGATIVE_REVIEWS)(r.name);
      } else if (k === 6 || k === 7) {
        // 2 tane orta yorum (rating 3)
        rating = 3;
        body = randomItem(MEDIUM_REVIEWS)(r.name);
      } else {
        // İlk 6: olumlu yorum (rating 4-5)
        rating = randomInt(4, 5);
        body = randomItem(POSITIVE_REVIEWS)(r.name);
      }

      testReviews.push({ userId: user.id, placeId: r.id, rating, body });
    }
  }

  const testReviewResult = await prisma.review.createMany({
    data: testReviews,
    skipDuplicates: true,
  });
  console.log(`  ${testReviewResult.count} test kullanicisi yorumu olusturuldu.`);

  // 5. Ana kullanıcı için yorumlar (iyi ve kötü karışık, 22 adet)
  console.log('\n[4/8] Ana kullanici yorumlari olusturuluyor...');

  let mainReviewCount = 0;
  if (mainUser) {
    const mainReviews = [];

    // Olumlu yorumlar: restoranlar 0-12 (13 adet, rating 4-5)
    for (let i = 0; i < 13; i++) {
      const r = RESTAURANTS[i];
      mainReviews.push({
        userId: mainUser.id,
        placeId: r.id,
        rating: randomInt(4, 5),
        body: randomItem(MAIN_GOOD_REVIEWS)(r.name),
      });
    }

    // Olumsuz yorumlar: restoranlar 15-20 (6 adet, rating 1-2)
    for (let i = 15; i < 21; i++) {
      const r = RESTAURANTS[i];
      mainReviews.push({
        userId: mainUser.id,
        placeId: r.id,
        rating: randomInt(1, 2),
        body: randomItem(MAIN_BAD_REVIEWS)(r.name),
      });
    }

    // Orta yorumlar: restoranlar 22-24 (3 adet, rating 3)
    for (let i = 22; i < 25; i++) {
      const r = RESTAURANTS[i];
      mainReviews.push({
        userId: mainUser.id,
        placeId: r.id,
        rating: 3,
        body: randomItem(MEDIUM_REVIEWS)(r.name),
      });
    }

    const mainReviewResult = await prisma.review.createMany({
      data: mainReviews,
      skipDuplicates: true,
    });
    mainReviewCount = mainReviewResult.count;
    console.log(`  ${mainReviewCount} ana kullanici yorumu olusturuldu (iyi: 13, kotu: 6, orta: 3).`);
  } else {
    console.log('  Ana kullanici bulunamadi, atlanıyor.');
  }

  // 6. Favoriler
  console.log('\n[5/8] Favoriler olusturuluyor...');

  const allFavorites = [];

  // Test kullanıcıları için 7 favori
  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const favIndices = getUserRestaurantIndices(i, 7);
    for (const rIdx of favIndices) {
      const r = RESTAURANTS[rIdx];
      allFavorites.push({
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

  // Ana kullanıcı için 12 favori
  if (mainUser) {
    for (let i = 0; i < 12; i++) {
      const r = RESTAURANTS[i];
      allFavorites.push({
        userId: mainUser.id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeLat: r.lat,
        placeLng: r.lng,
        placeRating: r.rating,
      });
    }
  }

  const favResult = await prisma.favorite.createMany({
    data: allFavorites,
    skipDuplicates: true,
  });
  console.log(`  ${favResult.count} favori olusturuldu.`);

  // 7. Öneriler (public + private)
  console.log('\n[6/8] Restoran onerileri olusturuluyor...');

  const recommendations = [];

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const rIndices = getUserRestaurantIndices(i, 5);

    // İlk 3: herkese açık profil önerisi (toUserId = null)
    for (let j = 0; j < 3; j++) {
      const r = RESTAURANTS[rIndices[j]];
      recommendations.push({
        fromUserId: user.id,
        toUserId: null,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
        placeTypes: ['restaurant', 'food'],
        message: randomItem(REC_MESSAGES),
      });
    }

    // Son 2: belirli arkadaşlara özel öneri
    for (let j = 3; j < 5; j++) {
      const r = RESTAURANTS[rIndices[j]];
      const toUser = testUsers[(i + j + 2) % testUsers.length];
      recommendations.push({
        fromUserId: user.id,
        toUserId: toUser.id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
        placeTypes: ['restaurant', 'food'],
        message: randomItem(REC_MESSAGES),
      });
    }
  }

  // Ana kullanıcı önerileri
  if (mainUser) {
    // 3 herkese açık
    for (let i = 0; i < 3; i++) {
      const r = RESTAURANTS[i];
      recommendations.push({
        fromUserId: mainUser.id,
        toUserId: null,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
        placeTypes: ['restaurant', 'food'],
        message: randomItem(REC_MESSAGES),
      });
    }
    // 5 test kullanıcısına özel
    for (let i = 0; i < 5; i++) {
      const r = RESTAURANTS[i + 3];
      recommendations.push({
        fromUserId: mainUser.id,
        toUserId: testUsers[i].id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
        placeTypes: ['restaurant', 'food'],
        message: randomItem(REC_MESSAGES),
      });
    }

    // İlk 5 test kullanıcısı da ana kullanıcıya öneri göndersin
    for (let i = 0; i < 5; i++) {
      const r = RESTAURANTS[(i + 10) % RESTAURANTS.length];
      recommendations.push({
        fromUserId: testUsers[i].id,
        toUserId: mainUser.id,
        placeId: r.id,
        placeName: r.name,
        placeAddress: r.address,
        placeRating: r.rating,
        placeTypes: ['restaurant', 'food'],
        message: randomItem(REC_MESSAGES),
      });
    }
  }

  const recResult = await prisma.recommendation.createMany({ data: recommendations });
  console.log(`  ${recResult.count} oneri olusturuldu (${recommendations.filter(r => !r.toUserId).length} public, ${recommendations.filter(r => r.toUserId).length} ozel).`);

  // 8. Mesajlaşmalar
  console.log('\n[7/8] Mesajlasmalar olusturuluyor...');

  const messages = [];

  // Test kullanıcıları arasında mesajlaşma (her kullanıcı 3 farklı arkadaşıyla)
  for (let i = 0; i < testUsers.length; i++) {
    const sender = testUsers[i];
    // 3 farklı alıcı (döngüsel)
    const receiverIndices = [
      (i + 1) % testUsers.length,
      (i + 4) % testUsers.length,
      (i + 7) % testUsers.length,
    ];

    for (const rIdx of receiverIndices) {
      const receiver = testUsers[rIdx];
      if (receiver.id === sender.id) continue;

      const thread = MESSAGE_THREADS[(i + rIdx) % MESSAGE_THREADS.length];
      for (let k = 0; k < thread.length; k++) {
        const isSenderTurn = k % 2 === 0;
        messages.push({
          senderId: isSenderTurn ? sender.id : receiver.id,
          receiverId: isSenderTurn ? receiver.id : sender.id,
          content: thread[k],
          isRead: k < thread.length - 1,
        });
      }
    }
  }

  // Test kullanıcıları ile ana kullanıcı arasında mesajlaşma (ilk 8 kullanıcı)
  if (mainUser) {
    for (let i = 0; i < 8; i++) {
      const u = testUsers[i];
      const thread = MESSAGE_THREADS[i % MESSAGE_THREADS.length];
      for (let k = 0; k < thread.length; k++) {
        const isSenderTurn = k % 2 === 0;
        messages.push({
          senderId: isSenderTurn ? u.id : mainUser.id,
          receiverId: isSenderTurn ? mainUser.id : u.id,
          content: thread[k],
          isRead: k < thread.length - 1,
        });
      }
    }
  }

  const msgResult = await prisma.message.createMany({ data: messages });
  console.log(`  ${msgResult.count} mesaj olusturuldu.`);

  // 9. Yıldız olayları ve star count güncellemesi
  console.log('\n[8/8] Yildiz puanlari guncelleniyor...');

  // Test kullanıcıları:
  //   10 yorum × 5 = 50 + 20 arkadaş × 1 = 20 + 5 öneri × 3 = 15 → 85 yıldız (Level 4)
  const TEST_STARS = 85;

  await prisma.user.updateMany({
    where: { id: { in: testUsers.map((u) => u.id) } },
    data: { starCount: TEST_STARS },
  });

  // Star events (özet olarak, 3'er kayıt)
  const starEvents = [];
  for (const user of testUsers) {
    starEvents.push({ userId: user.id, type: 'REVIEW', amount: 50, description: '10 restoran yorumu için yıldız ödülü' });
    starEvents.push({ userId: user.id, type: 'FRIEND_ADDED', amount: 20, description: '20 yeni arkadaşlık için yıldız ödülü' });
    starEvents.push({ userId: user.id, type: 'RECOMMENDATION', amount: 15, description: '5 restoran önerisi için yıldız ödülü' });
  }

  // Ana kullanıcı:
  //   22 yorum × 5 = 110 + 20 arkadaş × 1 = 20 + 8 öneri × 3 = 24 → 154 yıldız (Level 5)
  if (mainUser) {
    const MAIN_STARS = 154;
    await prisma.user.update({
      where: { id: mainUser.id },
      data: { starCount: Math.max(mainUser.starCount, MAIN_STARS) },
    });
    starEvents.push({ userId: mainUser.id, type: 'REVIEW', amount: 110, description: '22 restoran yorumu için yıldız ödülü' });
    starEvents.push({ userId: mainUser.id, type: 'FRIEND_ADDED', amount: 20, description: '20 yeni arkadaşlık için yıldız ödülü' });
    starEvents.push({ userId: mainUser.id, type: 'RECOMMENDATION', amount: 24, description: '8 restoran önerisi için yıldız ödülü' });
  }

  await prisma.starEvent.createMany({ data: starEvents });

  // UserReward — mevcut ödüllere göre kilitleri aç
  const rewards = await prisma.reward.findMany({ orderBy: { requiredStars: 'asc' } });
  if (rewards.length > 0) {
    const allSeedUsers = mainUser ? [...testUsers, mainUser] : testUsers;
    for (const user of allSeedUsers) {
      const userStars = user.id === mainUser?.id ? 154 : TEST_STARS;
      for (const reward of rewards) {
        if (reward.requiredStars <= userStars) {
          await prisma.userReward.upsert({
            where: { userId_rewardId: { userId: user.id, rewardId: reward.id } },
            create: { userId: user.id, rewardId: reward.id },
            update: {},
          });
        }
      }
    }
    console.log(`  Odul kilitleri acildi (${rewards.length} odul, ${allSeedUsers.length} kullanici).`);
  }

  // Özet
  console.log('\n==================================================');
  console.log('TAMAMLANDI!');
  console.log('==================================================');
  console.log(`  Kullanici       : ${testUsers.length} test + ${mainUser ? '1 ana' : '0 ana (bulunamadi)'}`);
  console.log(`  Arkadasliklar   : ${friendResult.count} yeni ilişki`);
  console.log(`  Yorumlar        : ${testReviewResult.count} test + ${mainReviewCount} ana kullanici`);
  console.log(`  Favoriler       : ${favResult.count}`);
  console.log(`  Oneriler        : ${recResult.count}`);
  console.log(`  Mesajlar        : ${msgResult.count}`);
  console.log(`  Level (test)    : 85 yildiz → Level 4 NearEat Elcisi`);
  if (mainUser) console.log(`  Level (ana)     : 154 yildiz → Level 5 Gastronomi Efsanesi`);
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error('\nHATA:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
