# Eatlas

> Mobil-öncelikli restoran keşif platformu. Yapay zekâ destekli kişisel öneriler, sosyal keşif, rezervasyon ve işletmeler için B2B araçlar.

**Eatlas**, çevrendeki en iyi restoranları keşfetmeni, yapay zekânın sana "ne yiyeceğini" önermesini, arkadaşlarınla paylaşmanı, liste yapıp rezervasyon almanı ve restoran sahiplerinin işletmelerini yönetmesini sağlar.

> **Markalama:** Ürün kullanıcıya **Eatlas** olarak sunulur (Android paketi `com.eatlas.mobile`). Repo, dizinler ve teknik tanımlayıcılar geçmişten gelen `NearEat`/`neareat` adını korur — yalnızca kullanıcıya dönük marka Eatlas'tır.

**Production URL:** `https://railway-up-production-6cdc.up.railway.app` · **Sağlık:** `/health`
**Platform:** Android (AAB ile Google Play kapalı testte) · **Güncel sürüm:** 2.0.8 (versionCode 36)

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Teknoloji Stack](#teknoloji-stack)
- [Proje Yapısı](#proje-yapısı)
- [Özellikler](#özellikler)
- [Üyelik & Premium](#üyelik--premium)
- [Uygulama İçi Satın Alma (IAP)](#uygulama-içi-satın-alma-iap)
- [E-posta Entegrasyonu](#e-posta-entegrasyonu)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [API Özeti](#api-özeti)
- [Mobil Uygulama](#mobil-uygulama)
- [Test](#test)
- [Deploy](#deploy)
- [Build (Android / iOS)](#build-android--ios)
- [Güvenlik](#güvenlik)

---

## Genel Bakış

Üç kullanıcı rolü, üç ayrı deneyim:

| Rol | Açıklama |
|---|---|
| **Normal Kullanıcı** | Restoran keşfeder, AI önerisi alır, favori/liste yapar, arkadaşlarıyla sosyalleşir, rezervasyon yapar |
| **Restoran Sahibi (B2B)** | İşletme profilini yönetir, online rezervasyon alır, kampanya & anlık indirim tanımlar, analitik görür |
| **Admin** | Restoran başvurularını onaylar, kullanıcı/şikayet yönetir, platform istatistik & loglarını izler |

Tüm kullanıcıya dönük arayüz **Türkçe**'dir.

---

## Teknoloji Stack

### Backend (`neareat-backend/`)
| Katman | Teknoloji |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| ORM | Prisma |
| Veritabanı | PostgreSQL 17 |
| Cache | Redis (ioredis) |
| Auth | Firebase Admin (Google OAuth) + bcryptjs/JWT (email) |
| Yapay Zekâ | Anthropic Claude (Haiku 4.5 / Sonnet 4.6, SSE streaming) |
| E-posta | Resend |
| Ödeme | Google Play Billing (googleapis / androidpublisher) |
| Depolama | AWS S3 (restoran/ürün fotoğrafları) |
| Deploy | Railway (push-to-deploy) |

### Mobil (`neareat-mobile/`)
| Katman | Teknoloji |
|---|---|
| Framework | Expo ~52 (bare workflow) |
| Platform | React Native 0.76 |
| Dil | TypeScript |
| State | Zustand |
| Navigation | React Navigation (native-stack + bottom-tabs) |
| HTTP | Axios |
| Harita | react-native-maps |
| IAP | expo-iap |
| Güvenli depolama | expo-secure-store |
| Paket adı | `com.eatlas.mobile` |

---

## Proje Yapısı

```
firstproject/                    # monorepo (repo adı: neareat)
├── neareat-backend/             # Node.js API
│   ├── prisma/
│   │   ├── schema.prisma        # Tek doğruluk kaynağı (DB modelleri)
│   │   ├── migrations/          # Sıralı, commit'li migration'lar
│   │   └── seed*.js             # seed / seed-users / seed-social-test
│   └── src/
│       ├── app.js               # Express giriş + middleware zinciri + webhook/landing route'ları
│       ├── controllers/         # Domain başına iş mantığı
│       ├── routes/              # HTTP → controller eşlemesi
│       ├── middleware/          # auth, roles, requirePremium, sanitize, rate-limit, securityLogger, requestId
│       ├── services/            # googlePlaces, firebase, redis, resend (email), anthropic, googleapis (IAP), s3
│       ├── jobs/                # Cron: reservationReminders, smartNotifications, feedbackAggregator, friendSuggestions
│       └── utils/               # prisma, jwt, tokenHash, premiumCheck, contentFilter, appLinkPage, haversine ...
│
├── neareat-mobile/              # React Native / Expo
│   └── src/
│       ├── navigation/          # rol bazlı stack + tab + global navigationRef
│       ├── screens/             # 40+ ekran (onboarding / user / restaurant / admin)
│       ├── components/          # AppHeader, EatlasLogo, AppIcon, Toast, Skeleton ...
│       ├── services/            # API istemcileri (axios)
│       ├── store/               # Zustand store'ları
│       ├── utils/               # premiumGate, notificationTarget, appRating, haptics ...
│       └── config.ts            # MOCK_MODE, API_URL
│
└── docs / *.md                  # Ürün/planlama dokümanları
```

---

## Özellikler

### Keşif & Arama
- GPS konumuna göre yakındaki restoranlar (Google Places), liste/harita görünümü
- Serbest metin / isim araması (`/places/search`, 25 km opsiyonel bias, Redis cache)
- Mutfak etiketleriyle filtre (13 etiket: Pizza, Kebap, Sushi …), "Açık" filtresi
- Tazelik sinyalleri: "kapanmaya yakın" (≤60 dk sarı / ≤30 dk kırmızı), "yeni açıldı"
- Restoran detayı: çift puan (Google + uygulama-içi **Eatlas** puanı), çalışma saatleri, duyuru, indirimler, foto galerileri, menü (premium)

### Yapay Zekâ Önerileri
"Bu akşam ne yesem?" — Claude tabanlı kişisel öneri motoru (SSE streaming).
- Aday üretimi (Google Places + Redis) → prompt cache-optimize → Claude → halüsinasyon filtresi → loglama
- **Konuşmasal iyileştirme** (`refinement`: "daha ucuz/yakın/sessiz"), oturum bağlamı Redis'te
- **Yolda öneri** (rota üzerinde en iyi 1-3 restoran), **fotoğraf analizi** (Vision)
- 👍/👎 geri bildirim → haftalık cron ile kişisel mutfak tercihlerine dönüşüp prompt'a enjekte edilir
- Tier: Free → Haiku, **günde 1 öneri**; Premium → Sonnet, **sınırsız** + arkadaş tat sinyalleri

### Sosyal
- Arkadaş ekleme/önerisi (gece 03:00 cron ile uyumluluk skorlu öneriler, Redis cache)
- Aktivite akışı, restoran önerme, liderlik tablosu (yıldız)
- **Yemek grupları** (arkadaşlarla mekan oylama), **check-in**, **yemek günlüğü**, **referans/davet**
- Birebir mesajlaşma (cursor sayfalama, okundu işareti, okunmamış badge)

### Rezervasyon
- Kullanıcı rezervasyon oluşturur/düzenler; kapasite kontrolü; durum akışı (PENDING/CONFIRMED…)
- Saatlik cron 24 saatten eski `PENDING` rezervasyonlar için restoran + kullanıcıya hatırlatma

### Favori & Listeler
- Favori ekleme, özel liste (koleksiyon) oluşturma + arkadaşlarla paylaşma

### Bildirimler
- Uygulama içi panel + push; tipler: FRIEND_REQUEST, INSTANT_DISCOUNT, LEVEL_UP, RECOMMENDATION, REVIEW_REPLY, FRIEND_SUGGESTION, RESERVATION_*, WEEKLY_DIGEST …
- Bildirim dokunuşları `utils/notificationTarget.ts` ile derin-link

### Gamification
- Yorum/öneri/favori → yıldız; 6 seviye; seviye atlama bildirimi; yıldız bazlı restoran indirimleri

### Restoran Sahibi (B2B)
- 5 adımlı kayıt + admin onayı; profil, görünen ad, alternatif telefon
- Çalışma saatleri, menü yükleme, **foto galerileri** (mekan + ürün, S3)
- Yıldız indirim programı + **anlık indirim** (premium) + **kampanya** push (premium, günde 1)
- **Analitik panel** + **AI haftalık işletme raporu** (premium)
- Yorumlara cevap, online **rezervasyon kabulü** (premium)

### Admin
- Restoran onay/red, kullanıcı yönetimi (askıya alma), şikayet yönetimi, aktivite logları, cron tetikleme

### İçerik Moderasyonu
`utils/contentFilter.js` — TR/EN uygunsuz içerik tespiti (leetspeak + Türkçe ek/varyant normalizasyonu). Yorum, yorum güncelleme, restoran cevabı, koleksiyon adı vb. noktalarda uygulanır.

---

## Üyelik & Premium

Ücretsiz sürüm tam işlevseldir; Premium **limitleri kaldırır** ve gelişmiş özellikler açar. Tüm kısıtlar backend'de `utils/premiumCheck.isPremiumUser()` ile uygulanır ve limit dolunca `403 { code: 'PREMIUM_REQUIRED' }` döner; mobil bunu yakalayıp rol-duyarlı **Paywall**'a yönlendirir (`utils/premiumGate.ts`).

### Normal Kullanıcı — Ücretsiz vs Premium
| Özellik | Ücretsiz | Premium |
|--------|:--------:|:-------:|
| AI yemek önerisi | Günde 1 | Sınırsız |
| Arkadaşa/herkese restoran önerme | Günde 1 | Sınırsız |
| Favori | En fazla 5 | Sınırsız |
| Liste (koleksiyon) | 1 | Sınırsız |
| Rezervasyon | 1 (ömür boyu) | Sınırsız |
| Menü & ürün fotoğrafları | — | ✓ |
| Keşif yarıçapı | 5 km | 25 km |
| AI modeli | Standart (Haiku) | Gelişmiş (Sonnet) + arkadaş sinyalleri |

### Restoran — Ücretsiz vs Premium
| Özellik | Ücretsiz | Premium |
|--------|:--------:|:-------:|
| Profil · menü · mekan fotoğrafları | ✓ | ✓ |
| Online rezervasyon kabulü | — | ✓ |
| Ürün fotoğraf galerisi | — | ✓ |
| Anlık indirim · kampanya | — | ✓ |
| Analitik panel · haftalık rapor | — | ✓ |

### Fiyatlar (Google Play)
> **Sprint-18/19 güncellemesi:** Bireysel kullanıcıdan ücret ALINMAZ — özellikler yıldız/seviye ile açılır (`user_premium` kaldırıldı). Restoran tarafı **tek-tip zorunlu ücretli**: 15 gün ücretsiz deneme, sonra aylık abonelik.

| Ürün ID | Kime | Ücret |
|--------|------|-------|
| `restaurant_premium` | Restoran | **1.299,90 ₺ / ay** (15 gün ücretsiz deneme) |

---

## Uygulama İçi Satın Alma (IAP)

Google Play Billing (abonelik). Mobil `expo-iap` ile satın alır, backend doğrular.

- **Doğrulama:** `POST /api/subscriptions/verify/android` — `purchaseToken`'ı `androidpublisher.purchases.subscriptions.get` ile doğrular, aboneliği upsert eder. Env yoksa 503 (graceful).
- **RTDN (gerçek zamanlı bildirim):** `POST /webhooks/google-play` — Pub/Sub push; abonelik durumu değişimlerini (yenileme/iptal/iptal/son) işler, her zaman 200 döner (retry loop önlemi).
- **Teşhis:** `GET /webhooks/google-play/last` — son alınan RTDN bildiriminin özeti (hassas veri yok); kurulum doğrulaması için.
- **Env:** `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME=com.eatlas.mobile`.

> Cloud altyapısı (Service Account + RTDN topic) ve adım adım kurulum için: `KAPALI_TEST_VE_IAP_REHBERI.md`.

---

## E-posta Entegrasyonu

**Resend** ile işlemsel e-postalar (`services/emailService.js`): doğrulama, şifre sıfırlama, hoş geldin. Eatlas markalı şablonlar (coral→amber), gönderici domain **`eatlastr.com`**.

- E-posta linkleri (`/verify-email`, `/reset-password`) çıplak `neareat://` redirect yerine markalı **landing sayfası** döner (`utils/appLinkPage.js`): deep-link'i otomatik dener + "Uygulamada Aç" + Play Store fallback (Gmail in-app tarayıcı engellerini aşmak için).
- Token'lar DB'de HMAC ile hash'lenir (`utils/tokenHash.js`); `forgot-password` e-posta enumerasyon koruması.

> Domain/DNS + Railway adımları: `EMAIL_KURULUM.md`.

---

## Kurulum

### Gereksinimler
Node.js 18+ · PostgreSQL 17 · Redis 7+ · Android Studio (Android build için)

### Backend
```bash
cd neareat-backend
npm install
cp .env.example .env          # değerleri doldur
npx prisma migrate deploy
node prisma/seed.js           # opsiyonel: admin seed
npm run dev                   # nodemon (port 3000)
```

### Mobil
```bash
cd neareat-mobile
npm install
npm run android               # expo run:android (emülatör/cihaz)
npm start                     # Metro / Expo dev server
```

---

## Ortam Değişkenleri

Backend `.env` (tam liste için `.env.example`):

```env
# Sunucu / DB / Cache
DATABASE_URL=postgresql://USER:PASS@HOST:5432/neareat_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=guclu-rastgele-secret
TOKEN_HASH_SECRET=ayri-uzun-rastgele-secret   # e-posta/şifre token HMAC; yoksa JWT_SECRET'e düşer

# Firebase Admin (Google OAuth doğrulama)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com   # mobil ile birebir aynı

# Harici servisler
GOOGLE_PLACES_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-api03-...
RESEND_API_KEY=re_...
EMAIL_FROM=Eatlas <noreply@eatlastr.com>
APP_BASE_URL=https://railway-up-production-6cdc.up.railway.app

# Google Play IAP
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_PLAY_PACKAGE_NAME=com.eatlas.mobile

# AWS S3 (restoran/ürün fotoğrafları)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_S3_BUCKET=eatlas-restaurant-photos

# Güvenlik / limitler
ADMIN_SEED_SECRET=...
ALLOWED_ORIGINS=https://yourdomain.com
FREE_RADIUS_KM=5
PREMIUM_RADIUS_KM=25
FREE_FAVORITES_LIMIT=5
TRIAL_DAYS=7
```

> Production'da `DATABASE_URL` / `REDIS_URL` Railway referans syntax'ı (`${{Postgres.DATABASE_URL}}`) ile enjekte edilir.

---

## API Özeti

Tam liste için route dosyalarına bakın (`src/routes/`). Öne çıkanlar:

| Alan | Örnek uçlar |
|---|---|
| **Auth** | `POST /api/auth/register` · `/login/email` · `/login` (Google) · `GET /me` · `DELETE /account` · `POST /verify-email` · `/resend-verification` · `/forgot-password` · `/reset-password` |
| **Keşif** | `GET /api/restaurants/nearby` · `/restaurants/:placeId` · `GET /api/places/search` · `/api/search-history` |
| **AI** | `POST /api/recommendations/dinner-tonight` (+ stream) · `/route` · `/photo-analyze` · feedback uçları |
| **Sosyal** | `/api/social/*` (friends, feed, leaderboard, friend-suggestions, recommendations) · `/api/meal-groups/*` · `/api/checkin` · `/api/diary` · `/api/referral` |
| **Mesaj** | `/api/messages/*` |
| **Liste/Favori** | `/api/collections/*` · `/api/favorites` |
| **Rezervasyon** | `/api/reservations/*` |
| **Abonelik** | `POST /api/subscriptions/verify/android` · `/trial` · `GET /api/subscriptions` |
| **Restoran B2B** | `/api/restaurant-account/*` (hours, menu, photos, discount, campaign, analytics, report, info, reviews) |
| **Admin** | `/api/admin/*` (stats, restaurants approve/reject, users, reports, logs, jobs) |
| **Webhook** | `POST /webhooks/google-play` · `GET /webhooks/google-play/last` |
| **E-posta landing** | `GET /verify-email` · `/reset-password` |

İstek akışı: `requestId → helmet/CORS → morgan → rate-limit → body-parse → sanitize → routes → auth → roles → controller → service → Prisma/Redis/dış API → errorHandler`.

---

## Mobil Uygulama

Rol bazlı kök stack'ler. **Normal kullanıcı**: alt 5 sekme — **Keşfet · Favoriler · Listeler · Mesajlar · Profil** + stack ekranları (detay, sosyal, AI öneri, rota öneri, rezervasyon, yemek grupları, ödüller, Paywall…). **Restoran** ve **Admin** kendi stack'lerini render eder.

- Ortak `AppHeader` (sol `EatlasLogo` gradient, rol-özel orta, sağ aksiyonlar), `AppIcon`/`Toast`/`Skeleton`/`EmptyState` paylaşımlı UI.
- Derin link: `neareat://` (e-posta doğrulama/şifre sıfırlama); global `navigation/navigationRef.ts` ile prop'suz yönlendirme.

Başlıca Zustand store'ları: `authStore` (oturum+rol+subscription), `restaurantStore`, `aiRecommendationStore`, `messageStore`, `collectionStore`, `favoriteStore`, `themeStore`.

---

## Test

```bash
# Backend
cd neareat-backend && npm test            # Jest (~1000 test)
npm test -- tests/integration/subscriptions.test.js

# Mobil
cd neareat-mobile && npm test             # Jest (store + util + ekran testleri)
```

> Backend testleri Firebase/Resend/Anthropic'i mock'lar. Bilinen 4 pre-existing kırık suite (recommendations*/candidateService/recommendationService — mock borcu) üretim kodunu etkilemez.

---

## Deploy

Railway'e `git push origin master` ile otomatik deploy. Backend service **Root Directory = `neareat-backend`** olmalı (monorepo).

`npm start` migration'ları otomatik uygular:
```json
"start": "prisma migrate resolve --rolled-back <isim> 2>/dev/null; prisma migrate deploy && node src/app.js"
```

İlk deploy sonrası admin seed:
```bash
curl -X POST https://<url>/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"secret":"<ADMIN_SEED_SECRET>","email":"...","password":"..."}'
```

Sağlık:
```bash
curl https://railway-up-production-6cdc.up.railway.app/health
# {"status":"ok","db":true,"redis":true,"uptime":N}
```

> Railway kurulumu, yaşanan 7 deploy sorunu ve çözümleri için git geçmişi ve `docs/` notlarına bakın.

---

## Build (Android / iOS)

### Android (AAB / APK)
```powershell
$env:JAVA_HOME  = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\KULLANICI\AppData\Local\Android\Sdk"
Set-Location "neareat-mobile\android"

.\gradlew.bat bundleRelease   --no-daemon   # Release AAB (Google Play)
.\gradlew.bat assembleRelease --no-daemon   # Release APK (direkt kurulum)
.\gradlew.bat assembleDebug   --no-daemon   # Debug APK
```
Çıktı (AAB): `app/build/outputs/bundle/release/app-release.aab`.

İmzalama `gradle.properties`'teki **upload keystore** ile yapılır (`neareat-upload.keystore`, alias `neareat`).
Play, yüklenen AAB'yi **Play App Signing** ile yeniden imzalar — Firebase'e 3 SHA-1 kayıtlı (debug + upload + Play App Signing).

> ⚠️ **Keystore'u yedekle:** `neareat-mobile/android/app/neareat-upload.keystore` (`.gitignore`'da). Kaybolursa Play Store güncellemesi yapılamaz.

### iOS
Henüz yayında değil (bundle id `com.neareat.app`, EAS cloud build ile planlı).

---

## Güvenlik

- **JWT** oturum (mobilde expo-secure-store / Keystore-Keychain), **Firebase Admin** ile Google OAuth doğrulama, **bcryptjs** (rounds 10)
- **Rate limiting:** auth 20/15 dk; api 120/dk (userId bazlı); AI/Vision uçlarına ek dakikalık limit
- **Premium gate'leri** ve **rol kontrolü** (`requirePremium`, `roles`), `sanitizeUser` ile `passwordHash` sızıntı önleme
- **İçerik filtresi**, **trust proxy** (Railway), CORS whitelist (origin'siz native istekler için izin)
- **Askıya alma:** `isSuspended` kullanıcılar işlem uçlarında reddedilir; mesaj yalnızca ACCEPTED arkadaşlar; şikayet spam koruması
- E-posta token'ları **HMAC-hash**'li; webhook'lar paket adı doğrular ve hassas veri ifşa etmez

---

## Lisans

Özel çalışma. Tüm hakları saklıdır.
