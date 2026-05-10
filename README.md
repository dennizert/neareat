# NearEat

Yakınındaki restoranları keşfetmeni, arkadaşlarınla paylaşmanı ve restoran sahiplerinin işletmelerini yönetmesini sağlayan React Native mobil uygulama.

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Teknoloji Stack](#teknoloji-stack)
- [Proje Yapısı](#proje-yapısı)
- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı](#veritabanı)
- [API Dokümantasyonu](#api-dokümantasyonu)
- [Mobil Uygulama](#mobil-uygulama)
- [Admin Paneli](#admin-paneli)
- [Deploy](#deploy)
- [Güvenlik](#güvenlik)

---

## Genel Bakış

NearEat üç farklı kullanıcı tipi için ayrı deneyimler sunar:

| Kullanıcı Tipi | Açıklama |
|---|---|
| **Normal Kullanıcı** | Restoran keşfeder, favori ekler, yorum yazar, arkadaşlarıyla paylaşır |
| **Restoran Sahibi** | İşletme profilini yönetir, indirim tanımlar, yorumlara cevap verir |
| **Admin** | Restoran başvurularını onaylar, kullanıcı şikayetlerini yönetir, platform istatistiklerini izler |

**Production URL:** `https://railway-up-production-6cdc.up.railway.app`

---

## Teknoloji Stack

### Backend (`neareat-backend/`)
| Katman | Teknoloji |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| ORM | Prisma v5 |
| Veritabanı | PostgreSQL 17 |
| Cache | Redis (ioredis) |
| Auth | Firebase Admin (Google OAuth) + bcryptjs/jsonwebtoken (email) |
| Deploy | Railway |

### Mobil (`neareat-mobile/`)
| Katman | Teknoloji |
|---|---|
| Framework | Expo ~52 (Bare Workflow) |
| Platform | React Native 0.76.3 |
| State | Zustand |
| Navigation | React Navigation v6 |
| HTTP | Axios |
| Maps | react-native-maps 1.18.0 |
| Secure Storage | expo-secure-store |
| Build | Gradle (Android), EAS CLI (iOS) |
| Bundle ID | `com.neareat.app` |

---

## Proje Yapısı

```
firstproject/
├── neareat-backend/          # Node.js API sunucusu
│   ├── prisma/
│   │   ├── schema.prisma     # Veritabanı şeması
│   │   ├── migrations/       # Sıralı SQL migration'ları
│   │   └── seed.js           # Admin hesabı seed
│   └── src/
│       ├── app.js            # Express uygulama giriş noktası
│       ├── controllers/      # İş mantığı (12 dosya)
│       ├── routes/           # Route tanımları (12 dosya)
│       ├── middleware/       # auth, roles, errorHandler, requirePremium
│       ├── services/         # Firebase, GooglePlaces, Redis, bildirim
│       └── utils/            # jwt, prisma, stars, haversine, contentFilter
│
├── neareat-mobile/           # React Native / Expo uygulaması
│   ├── src/
│   │   ├── navigation/       # Stack + Tab navigasyon
│   │   ├── screens/          # 30+ ekran (onboarding, home, social, admin...)
│   │   ├── components/       # RestaurantCard, NotificationBell, StarRating...
│   │   ├── services/         # API istemcileri (axios)
│   │   ├── store/            # Zustand store'ları
│   │   ├── types/            # TypeScript arayüzleri
│   │   └── config.ts         # MOCK_MODE, API URL
│   └── android/              # Android native kodu
│
└── gen_icon.py               # Uygulama ikonu üretici (Python/Pillow)
```

---

## Özellikler

### Normal Kullanıcı

#### Restoran Keşfi
- GPS konumuna göre yakındaki restoranları listele (Google Places API)
- Harita görünümü (özel yemek pin marker'ı)
- Mutfak tipi filtresi, mesafe & puan sıralaması
- "Kapanmak Üzere" uyarıları (≤60 dk sarı, ≤30 dk kırmızı)
- Restoran detay: menü (premium), çalışma saatleri, duyurular, indirimler

#### Favori & Koleksiyonlar
- Favori ekleme (ücretsiz: 3 limit, premium: sınırsız)
- Koleksiyon oluşturma ve arkadaşlarla paylaşma
- Paylaşılan koleksiyonları arkadaş profilinde görme

#### Sosyal Özellikler
- Kullanıcı arama ve arkadaş ekleme (opsiyonel not ile)
- Arkadaş öneri algoritması (konum + ortak favoriler + ortak mutfak puanı)
- Restoran önerisi gönderme
- Liderlik tablosu (yıldız sayısına göre top 5 + kendi sıralaması)

#### Mesajlaşma
- Arkadaşlar arası birebir mesajlaşma
- Okunmamış mesaj sayısı (alt navigasyon badge'i)
- Cursor-based sayfalama (eski mesajlar yüklenebilir)
- Okundu işareti (✓ gönderildi / ✓✓ okundu)

#### Gamification
- Yorum yazma, öneri gönderme, favori ekleme → yıldız kazanma
- Yıldız seviyesi: Yeni Keşifçi → Usta Lezzetçi (6 seviye)
- Seviye atlamada bildirim
- Yıldız bazlı restoran indirimleri

#### Bildirimler
- Uygulama içi bildirim paneli (zil ikonu + kırmızı badge)
- Bildirim tipleri: FRIEND_REQUEST, INSTANT_DISCOUNT, LEVEL_UP, RECOMMENDATION, REVIEW_REPLY, FRIEND_SUGGESTION, REPORT_RESOLVED

---

### Restoran Sahibi

| Özellik | Açıklama |
|---|---|
| **Kayıt** | 5 adım: hesap → işletme bilgileri → vergi levhası → restoran seç → onay bekle |
| **Dashboard** | Toplam yorum, favori, öneri, ortalama puan istatistikleri |
| **Çalışma Saatleri** | 7 gün bağımsız saat aralıkları + günlük override |
| **Menü** | Görsel yükleme (max 10 görsel, base64, 5MB limit) |
| **İndirim** | Yıldız programı (seviyeye göre %) + anlık indirim (süreli) |
| **Duyuru** | Kısa metin duyurusu (kullanıcılara kart üzerinde görünür) |
| **Yorum Cevaplama** | Kullanıcı yorumlarına cevap yaz (max 500 karakter) |

---

### İçerik Moderasyonu

Backend'de `contentFilter.js` utility'si:
- Türkçe ve İngilizce uygunsuz kelimeler/ifadeler tespiti
- Leetspeak ve Türkçe karakter varyantlarını normalize eder
- Kök kelime + Türkçe ek kombinasyonlarını yakalar
- **Uygulama noktaları:** yorum oluşturma, yorum güncelleme, restoran cevabı

Uygunsuz içerik reddedilir ve veritabanına kaydedilmez.

---

## Kurulum

### Gereksinimler

- Node.js 18+
- PostgreSQL 17
- Redis 7+
- Android Studio (Android build için)
- Python 3.13+ (ikon üretimi için)

### Backend

```bash
cd neareat-backend
npm install

# .env dosyasını oluştur (örnek için .env.example'a bak)
cp .env.example .env

# Veritabanı migration'larını uygula
npx prisma migrate deploy

# Opsiyonel: Admin seed
node prisma/seed.js

# Geliştirme sunucusu
node src/app.js
```

### Mobil

```bash
cd neareat-mobile
npm install

# Android geliştirme
npx expo run:android

# Metro bundler
npx expo start
```

---

## Ortam Değişkenleri

Backend için `.env` dosyası oluştur:

```env
DATABASE_URL=postgresql://postgres:SIFRE@localhost:5432/neareat_db
JWT_SECRET=guclu-rastgele-secret-buraya

# Google Places API
GOOGLE_PLACES_API_KEY=AIza...

# Firebase Admin SDK
FIREBASE_PROJECT_ID=proje-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@proje-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Uygulama ayarları
FREE_RADIUS_KM=5
PREMIUM_RADIUS_KM=25
FREE_FAVORITES_LIMIT=5
TRIAL_DAYS=7
REDIS_NEARBY_TTL=3600
REDIS_PLACE_DETAILS_TTL=86400

# Redis
REDIS_URL=redis://localhost:6379
```

> **Not:** Production'da `DATABASE_URL` ve `REDIS_URL` Railway servis referanslarıyla otomatik enjekte edilir.

---

## Veritabanı

### Prisma Migration Sırası

| Migration | İçerik |
|---|---|
| `20260506072613_add_social_features` | Arkadaş, öneri, yıldız, ödül tabloları |
| `20260506114507_add_email_auth` | Email auth alanları |
| `20260510011750_add_collections` | Koleksiyon + koleksiyon öğesi |
| `20260510014608_add_restaurant_accounts` | UserRole enum, RestaurantProfile, ReviewReply |
| `20260510024504_add_last_login_at` | User.lastLoginAt |
| `20260510174701_add_notifications` | Notification tablosu |
| `20260511120000_add_messages_and_reports` | Message, UserReport + FriendRequest.note |

### Ana Tablolar

```
User               — kullanıcılar (USER / RESTAURANT / ADMIN)
RestaurantProfile  — restoran profilleri (PENDING / APPROVED / REJECTED)
RestaurantMenu     — base64 menü görselleri
Review             — kullanıcı yorumları
ReviewReply        — restoran cevapları
Favorite           — favoriler
Collection         — koleksiyonlar
CollectionItem     — koleksiyon restoranları
FriendRequest      — arkadaşlık istekleri (+ opsiyonel not)
Recommendation     — restoran önerileri
StarEvent          — yıldız kazanma olayları
Notification       — uygulama içi bildirimler
Message            — arkadaşlar arası mesajlar
UserReport         — kullanıcı şikayetleri
```

---

## API Dokümantasyonu

### Auth

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Email ile kayıt |
| POST | `/api/auth/login/email` | Email ile giriş |
| POST | `/api/auth/login` | Firebase (Google) ile giriş |
| GET | `/api/auth/me` | Oturum bilgileri |
| DELETE | `/api/auth/account` | Hesap silme |

### Restoranlar

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/restaurants/nearby` | Yakındaki restoranlar (lat, lng, radius) |
| GET | `/api/restaurants/:id` | Restoran detayı |

### Yorumlar

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/reviews/:placeId` | Yorumları listele |
| POST | `/api/reviews` | Yorum oluştur / güncelle |
| PUT | `/api/reviews/:reviewId` | Yorum düzenle |
| DELETE | `/api/reviews/:reviewId` | Yorum sil |

### Sosyal

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/social/friends` | Arkadaş listesi |
| POST | `/api/social/friends/requests` | Arkadaşlık isteği gönder (note opsiyonel) |
| GET | `/api/social/friends/requests/pending` | Bekleyen istekler |
| POST | `/api/social/friends/requests/:id/accept` | İsteği kabul et |
| DELETE | `/api/social/friends/requests/:id` | İsteği reddet |
| DELETE | `/api/social/friends/:friendId` | Arkadaşlıktan çıkar |
| GET | `/api/social/leaderboard` | Yıldız liderlik tablosu |
| GET | `/api/social/friend-suggestions` | Arkadaş önerileri |
| POST | `/api/social/users/:userId/report` | Kullanıcı şikayet et |

### Mesajlar

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/messages/conversations` | Konuşma listesi |
| GET | `/api/messages/unread-count` | Okunmamış mesaj sayısı |
| GET | `/api/messages/:userId` | Belirli kullanıcı ile mesajlar |
| POST | `/api/messages/:userId` | Mesaj gönder |

### Koleksiyonlar

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/collections` | Kendi koleksiyonlarım |
| POST | `/api/collections` | Koleksiyon oluştur |
| PUT | `/api/collections/:id` | Koleksiyon düzenle |
| DELETE | `/api/collections/:id` | Koleksiyon sil |
| POST | `/api/collections/:id/items` | Restoran ekle |
| DELETE | `/api/collections/:id/items/:itemId` | Restoran çıkar |
| POST | `/api/collections/:id/share` | Arkadaşlarla paylaş |
| GET | `/api/collections/shared-by/:userId` | Arkadaşın paylaştıkları |

### Restoran Hesabı

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/restaurant-account/register` | Restoran kaydı |
| GET | `/api/restaurant-account/me` | Profil bilgileri |
| PUT | `/api/restaurant-account/hours` | Çalışma saatleri |
| POST | `/api/restaurant-account/menu` | Menü görseli yükle |
| DELETE | `/api/restaurant-account/menu/:itemId` | Menü görseli sil |
| POST | `/api/restaurant-account/reviews/:reviewId/reply` | Yoruma cevap ver |
| DELETE | `/api/restaurant-account/reviews/:reviewId/reply` | Cevabı sil |
| PUT | `/api/restaurant-account/discount` | İndirim ayarları |
| POST | `/api/restaurant-account/instant-discount/activate` | Anlık indirim aktifleştir |
| DELETE | `/api/restaurant-account/instant-discount` | Anlık indirim kapat |
| PUT | `/api/restaurant-account/announcement` | Duyuru güncelle |
| PUT | `/api/restaurant-account/info` | İletişim bilgileri |
| GET | `/api/restaurant-account/stats` | İstatistikler |

### Admin

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/admin/login` | Admin girişi |
| GET | `/api/admin/stats` | Platform istatistikleri |
| GET | `/api/admin/restaurants` | Restoran listesi (status filtresi) |
| PUT | `/api/admin/restaurants/:id/approve` | Onayla |
| PUT | `/api/admin/restaurants/:id/reject` | Reddet |
| GET | `/api/admin/users` | Kullanıcı listesi |
| PUT | `/api/admin/users/:id/suspend` | Hesabı askıya al |
| DELETE | `/api/admin/reviews/:id` | Yorumu sil |
| GET | `/api/admin/reports` | Şikayet listesi |
| PUT | `/api/admin/reports/:id` | Şikayet işlemi (suspend/warn/dismiss) |

---

## Mobil Uygulama

### Ekranlar

#### Normal Kullanıcı Akışı
```
Onboarding
├── LocationPermissionScreen   — konum izni
├── LoginScreen                — Google + Email tabs
└── RegisterScreen             — email kayıt

Ana Navigasyon (5 Tab)
├── Keşfet (HomeScreen)        — restoran listesi + harita
├── Favoriler (FavoritesScreen)
├── Listeler (CollectionsScreen)
├── Mesajlar (MessagesScreen)  — okunmamış badge
└── Profil (ProfileScreen)

Stack Ekranlar
├── RestaurantDetailScreen
├── FriendsScreen / FriendProfileScreen
├── FriendSuggestionsScreen
├── ConversationScreen         — chat
├── RewardsScreen              — yıldızlar + liderlik
├── CollectionDetailScreen
└── NotificationsScreen
```

#### Restoran Sahibi Akışı
```
RestaurantRegisterScreen       — 5 adım kayıt
RestaurantPendingScreen        — onay bekleme
RestaurantDashboardScreen
├── RestaurantHoursScreen
├── RestaurantMenuScreen
├── RestaurantDiscountScreen
├── RestaurantReviewsScreen
└── RestaurantInfoScreen
```

#### Admin Akışı
```
AdminDashboardScreen
├── Sekmeler: Bekleyenler / Onaylılar / Reddedilenler / Şikayetler / İstatistikler
└── AdminRestaurantDetailScreen
```

### Zustand Store'ları

| Store | İçerik |
|---|---|
| `authStore` | user, subscription, restaurantStatus, token |
| `favoriteStore` | favoriler listesi |
| `friendStore` | arkadaşlar, öneri listesi |
| `notificationStore` | bildirimler, okunmamış sayısı |
| `messageStore` | konuşmalar, okunmamış mesaj sayısı |
| `collectionStore` | koleksiyonlar |
| `restaurantStore` | yakın restoranlar, filtreler |
| `userProfileStore` | profil, yıldız, ödüller |

---

## Admin Paneli

Production'daki admin hesabı:
- **E-posta:** `neareatadmin@gmail.com`
- **Şifre:** `123456789`

Admin oluşturmak için: `POST /api/admin/seed`

---

## Deploy

### Railway (Production)

```bash
# railway CLI gerekmeli (ayrı terminal — VSCode terminali interaktif komutları desteklemiyor)
railway login

# Backend deploy (--service flag zorunlu — birden fazla servis var)
cd neareat-backend
railway up --service "railway up" --detach
```

**Servisler:**
- `railway up` — Node.js backend
- `Postgres` — PostgreSQL (postgres-volume)
- `Redis` — Redis (redis-volume)

Migration'lar her deploy'da `package.json` start komutu ile otomatik uygulanır:
```json
"start": "prisma migrate deploy && node src/app.js"
```

### Android APK Build

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\KULLANICI\AppData\Local\Android\Sdk"
Set-Location "neareat-mobile\android"

# Debug APK
.\gradlew.bat assembleDebug --no-daemon

# Release APK (imzalı, direkt kurulum)
.\gradlew.bat assembleRelease --no-daemon

# Release AAB (Google Play)
.\gradlew.bat bundleRelease --no-daemon
```

> **Keystore:** `neareat-mobile/android/app/neareat-upload.keystore` — kaybolursa Play Store güncellemesi yapılamaz, yedekle.

### iOS (EAS Cloud Build)

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios   # TestFlight'a gönder
```

---

## Güvenlik

- **JWT** ile oturum yönetimi (Android Keystore / iOS Keychain via expo-secure-store)
- **Firebase Admin SDK** ile Google OAuth doğrulama
- **bcryptjs** ile şifre hash'leme (salt rounds: 10)
- **Rate limiting:** auth 20 req/15 dk, api 120 req/1 dk
- **CORS:** whitelist tabanlı (native mobile istekler için Origin-less izin)
- **Trust proxy:** Railway reverse proxy için `app.set('trust proxy', 1)`
- **Sanitize:** API response'lardan `passwordHash` temizlenir
- **Askıya alma:** `isSuspended=true` kullanıcılar tüm işlem endpoint'lerinde reddedilir
- **İçerik filtresi:** Yorum ve restoran cevaplarında uygunsuz içerik önleme
- **Mesaj/şikayet:** Yalnızca ACCEPTED arkadaşlar mesajlaşabilir; 24h şikayet spam önleme

---

## Lisans

Bu proje özel bir çalışmadır. Tüm haklar saklıdır.
