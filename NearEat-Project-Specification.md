# NearEat — Lokasyon Tabanlı Restoran Keşif Uygulaması
## Proje Spesifikasyon Dokümanı v1.0

---

## İçindekiler

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Teknik Stack](#2-teknik-stack)
3. [Mimari Yapı](#3-mimari-yapı)
4. [Kullanıcı Tipleri & Üyelik Modeli](#4-kullanıcı-tipleri--üyelik-modeli)
5. [Kimlik Doğrulama](#5-kimlik-doğrulama)
6. [Onboarding Akışı](#6-onboarding-akışı)
7. [Ekranlar & Özellikler (Detaylı)](#7-ekranlar--özellikler-detaylı)
8. [Veri Modeli](#8-veri-modeli)
9. [API Entegrasyonları](#9-api-entegrasyonları)
10. [Ödeme Sistemi](#10-ödeme-sistemi)
11. [Push Bildirimler](#11-push-bildirimler)
12. [İş Kuralları & Kısıtlamalar](#12-iş-kuralları--kısıtlamalar)
13. [İş Önerileri & Büyüme Stratejisi](#13-iş-önerileri--büyüme-stratejisi)
14. [V2 Kapsamı](#14-v2-kapsamı)
15. [Yayın Planı](#15-yayın-planı)

---

## 1. Proje Genel Bakış

### 1.1 Uygulama Adı
**NearEat**

### 1.2 Temel Amaç
NearEat, kullanıcının anlık GPS konumunu kullanarak çevresindeki restoranları Google Places API üzerinden listeleyen, sıralayan, filtreleyen ve detaylı olarak gösteren bir mobil uygulamadır. Kullanıcı "Şu an nerede yesem?" sorusuna hızlı, güvenilir ve görsel olarak zengin bir cevap alır.

### 1.3 Platform
| Platform | Durum |
|---|---|
| iOS | V1 — Öncelikli geliştirme |
| Android | V1.1 — iOS sonrası |

### 1.4 Hedef Pazar
Global. Dil desteği başlangıçta Türkçe ve İngilizce olacak şekilde yapılandırılabilir; lokalizasyon altyapısı kurulmalıdır.

### 1.5 İş Modeli
Freemium — Ücretsiz temel kullanım + aylık/yıllık premium abonelik.

---

## 2. Teknik Stack

| Katman | Teknoloji | Açıklama |
|---|---|---|
| Mobil Framework | React Native + Expo | iOS ve Android için tek codebase |
| Backend | Node.js + Express | REST API sunucusu |
| Veritabanı | PostgreSQL | İlişkisel veri yönetimi |
| ORM | Prisma | Veritabanı şema ve sorgu yönetimi |
| Kimlik Doğrulama | Firebase Authentication | Google Sign-In yönetimi |
| Harita | Google Maps SDK (React Native) | Harita görünümü |
| Restoran Verisi | Google Places API | Nearby Search + Place Details + Photos |
| Uzaklık Hesabı | Haversine Formülü | Client-side, gerçek zamanlı hesaplama |
| Ödeme | İyzico | Abonelik ve ödeme işlemleri |
| Depolama | AWS S3 | Kullanıcı tarafından yüklenen içerikler |
| Push Bildirim | Firebase Cloud Messaging (FCM) | iOS & Android bildirimleri |
| In-App Purchase | Apple StoreKit 2 (iOS) | App Store abonelik yönetimi |
| Cache | Redis | Google Places API yanıtları cache'leme |
| Hosting | AWS (EC2 + RDS) veya Railway | Backend ve veritabanı barındırma |

---

## 3. Mimari Yapı

```
[Mobil Uygulama - React Native]
        │
        ├── Google Sign-In (Firebase Auth)
        ├── Google Maps SDK (harita render)
        ├── Haversine Hesabı (client-side)
        │
        ▼
[NearEat Backend API - Node.js/Express]
        │
        ├── PostgreSQL (kullanıcı, favori, yorum, ödeme verileri)
        ├── Redis Cache (Google Places API yanıtları)
        ├── Firebase Admin SDK (token doğrulama)
        ├── İyzico SDK (ödeme işlemleri)
        │
        ▼
[Dış Servisler]
        ├── Google Places API (restoran verileri)
        ├── Firebase Cloud Messaging (push bildirimler)
        └── AWS S3 (dosya depolama)
```

### 3.1 Google Places API Cache Stratejisi
- Google Places API'ye doğrudan her istek için çağrı yapılmaz; maliyet ve hız açısından kritik.
- Backend, belirli bir `place_id` için API yanıtını Redis'te **24 saat** saklar.
- Kullanıcı konumu değiştikçe yeni Nearby Search yapılır; sonuçlar cache'lenir.
- Place Details (telefon, çalışma saatleri, fotoğraflar) ayrıca cache'lenir.

---

## 4. Kullanıcı Tipleri & Üyelik Modeli

### 4.1 Ücretsiz Kullanıcı
| Özellik | Limit |
|---|---|
| Restoran arama yarıçapı | 5 km |
| Favori restoran | Maksimum 5 |
| Sıralama & filtreleme | Temel (mesafe, puan, yorum, filtreler) |
| Restoran detay görüntüleme | ✅ Tam erişim |
| Fotoğraf galerisi | ✅ Tam erişim |
| Google yorumlarını görme | ✅ Tam erişim |
| Uygulama içi yorum yazma | ❌ |
| "En kalabalık saatler" grafiği | ❌ |
| iOS Widget | ❌ |
| Reklam | ✅ Gösterilir |
| Çevrimdışı favori görüntüleme | ❌ |

### 4.2 Premium Kullanıcı
| Özellik | Detay |
|---|---|
| Restoran arama yarıçapı | Sınırsız (veya 25 km) |
| Favori restoran | Limitsiz |
| Uygulama içi yorum & puanlama | ✅ |
| "En kalabalık saatler" grafiği | ✅ |
| iOS Ana Ekran Widget | ✅ |
| Reklam | ❌ Reklamsız deneyim |
| Çevrimdışı favori görüntüleme | ✅ |

### 4.3 Abonelik Planları

| Plan | Açıklama | Uygulama |
|---|---|---|
| Aylık | Standart fiyat, her ay yenilenir | İyzico + StoreKit |
| Yıllık | %35 indirimli, yılda bir ödeme | İyzico + StoreKit |

> **Not:** Yıllık plan, onboarding ve paywall ekranlarında varsayılan seçili olarak sunulmalıdır.

### 4.4 Ücretsiz Premium Deneme
- Yeni kullanıcılara **7 günlük ücretsiz premium deneme** sunulur.
- Deneme bitiminde otomatik ücretlendirme **yapılmaz**; kullanıcıdan açık onay alınır.
- Deneme bittiğinde push bildirim + uygulama içi mesaj ile kullanıcı bilgilendirilir.

---

## 5. Kimlik Doğrulama

### 5.1 Giriş Yöntemi
- **Yalnızca Google Sign-In** (Firebase Authentication üzerinden)
- Apple Sign-In zorunluluğu: App Store kuralları gereği, iOS uygulamasında sosyal giriş sunuluyorsa Apple Sign-In da sunulmalıdır. Bu gereksinim değerlendirilmelidir.

### 5.2 Akış
1. Kullanıcı "Google ile Giriş Yap" butonuna basar.
2. Google OAuth ekranı açılır.
3. Kullanıcı Google hesabını seçer.
4. Firebase Authentication token döner.
5. Backend, token'ı Firebase Admin SDK ile doğrular.
6. Kullanıcı `users` tablosunda yoksa yeni kayıt oluşturulur; varsa session başlatılır.
7. Kullanıcı profili Google'dan otomatik doldurulur: ad, e-posta, profil fotoğrafı.

### 5.3 Oturum Yönetimi
- Firebase ID token her API isteğinde `Authorization: Bearer <token>` header'ı ile gönderilir.
- Token süresi dolunca Firebase SDK otomatik yeniler.
- Oturum aktifse uygulama açıldığında doğrudan ana ekrana yönlendirilir.

---

## 6. Onboarding Akışı

Uygulamayı ilk kez açan kullanıcı 3 adımlı bir karşılama ekranından geçer:

### Ekran 1 — Konum İzni
- Görsel: Harita animasyonu veya konum ikonu
- Başlık: "Çevreni keşfet"
- Açıklama: "Yakınındaki en iyi restoranları gösterebilmemiz için konumuna ihtiyacımız var."
- CTA Butonu: "Konuma İzin Ver"
- İzin reddedilirse: Kullanıcı manuel olarak şehir/ilçe girebilir (fallback).

### Ekran 2 — Google ile Giriş
- Görsel: Restoran/yemek temalı illüstrasyon
- Başlık: "Hemen başla"
- Açıklama: "Favorilerini kaydet, yorum yap, kişiselleştirilmiş deneyim yaşa."
- CTA Butonu: "Google ile Giriş Yap"

### Ekran 3 — Premium Tanıtımı
- Görsel: Premium özelliklerin görsel listesi
- Başlık: "7 gün ücretsiz dene"
- Özellik listesi: Limitsiz mesafe, sınırsız favori, reklamsız, uygulama içi yorum
- CTA Butonu: "Ücretsiz Dene" (ön plana çıkarılmış)
- Atlama Seçeneği: "Hayır, teşekkürler" (küçük metin linki)

---

## 7. Ekranlar & Özellikler (Detaylı)

### 7.1 Ana Ekran — Restoran Listesi & Harita

#### Görünüm Seçimi
Ana ekranın üst kısmında toggle/segment control ile iki görünüm arasında geçiş yapılır:
- **Liste Görünümü** (varsayılan)
- **Harita Görünümü**

---

#### 7.1.1 Liste Görünümü

Her restoran kart formatında gösterilir. Kart içeriği:

| Alan | Kaynak | Açıklama |
|---|---|---|
| Restoran adı | Google Places | |
| Kapak fotoğrafı (thumbnail) | Google Places Photos API | İlk fotoğraf |
| Google puanı | Google Places | Yıldız ikonu + sayısal değer (ör: ★ 4.5) |
| Toplam oy sayısı | Google Places | `user_ratings_total` |
| Yorum sayısı | Google Places | `reviews` array uzunluğu |
| Kullanıcıya mesafe | Haversine hesabı | GPS konumu ile place koordinatı arasında |
| Açık / Kapalı badge | Google Places | `opening_hours.open_now` |
| Mutfak türü | Google Places | `types` array |
| Fiyat aralığı | Google Places | `price_level` → ₺ / ₺₺ / ₺₺₺ / ₺₺₺₺ |
| Favori ikonu | Lokal DB | Dolu/boş kalp ikonu |

**Uzaklık Hesabı — Haversine Formülü:**
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c   (R = 6371 km)
```
Hesap client-side yapılır. Kullanıcının güncel GPS koordinatı ile Google Places'tan gelen her restoranın koordinatı (`geometry.location`) kullanılır.

---

#### 7.1.2 Harita Görünümü

- Google Maps SDK ile render edilir.
- Restoranlar harita üzerinde **özel pin ikonları** ile gösterilir.
- Kullanıcının konumu farklı renkte bir pin veya nabız efektli nokta olarak gösterilir.
- Bir pine tıklanınca **mini popup kart** açılır:
  - Restoran adı
  - Google puanı
  - Kullanıcıya mesafe
  - "Detayı Gör" butonu
- "Detayı Gör" butonuna tıklanınca Restoran Detay ekranına yönlendirilir.
- Harita üzerinde kaydırma yapılınca görünen alan içindeki restoranlar otomatik güncellenir.

---

#### 7.1.3 Sıralama Seçenekleri

Liste görünümünde üst kısımda açılır menü veya chip sırası ile:

| Sıralama Kriteri | Açıklama |
|---|---|
| Mesafe (varsayılan) | En yakından en uzağa |
| Google Puanı | En yüksekten en düşüğe |
| Oy Sayısı | En çok oydan en aza |
| Yorum Sayısı | En çok yorumlananlar üstte |

---

#### 7.1.4 Filtreleme

Üst çubukta chip formatında filtreler gösterilir. Aktif filtreler dolgu rengiyle vurgulanır.

| Filtre | Seçenekler | Kaynak |
|---|---|---|
| Mutfak Türü | Türk, İtalyan, Japon, Fast Food, Kafe, vb. | Google Places `types` |
| Açık / Kapalı | Yalnızca şu an açık olanları göster | `opening_hours.open_now` |
| Fiyat Aralığı | ₺ / ₺₺ / ₺₺₺ / ₺₺₺₺ | `price_level` (1-4) |

Birden fazla filtre aynı anda aktif olabilir.

---

### 7.2 Restoran Detay Ekranı

Bir restoran kartına veya harita popup'ına tıklanınca açılır.

#### 7.2.1 Fotoğraf Galerisi
- Yatay kaydırmalı, tam genişlikte fotoğraf galerisi (Google Places Photos API)
- Fotoğrafa tıklanınca tam ekran görüntüleme modu açılır
- Pinch-to-zoom desteği tam ekran modunda

#### 7.2.2 Temel Bilgiler
| Alan | Kaynak |
|---|---|
| Restoran adı | Google Places |
| Mutfak türü | Google Places |
| Fiyat aralığı | Google Places |
| Google puanı (yıldız + sayısal) | Google Places |
| Toplam oy sayısı | Google Places |
| Yorum sayısı | Google Places |
| Kullanıcıya mesafe | Haversine |

#### 7.2.3 İletişim & Konum
| Alan | Davranış |
|---|---|
| Adres | Metin olarak gösterilir |
| Telefon numarası | Tıklanınca `tel:<numara>` deep link ile cihazın arama uygulaması açılır |
| Çalışma saatleri | Günlük liste; bugünün satırı kalın/renkli vurgulanır |
| "Yol Tarifi Al" butonu | Tıklanınca kullanıcıya seçim sunulur: Google Maps veya Apple Maps. Seçilen uygulamada restoranın koordinatına navigasyon başlatılır. |

#### 7.2.4 Google Yorumları Sekmesi
- Google Places API'den dönen yorumlar listelenir
- Her yorum kartında:
  - Kullanıcı adı ve profil fotoğrafı
  - Yıldız puanı
  - Yorum tarihi (`relative_time_description`)
  - Yorum metni
- Maksimum 5 yorum Google API'den döner; bu limit Google Places API kısıtıdır.

#### 7.2.5 Uygulama İçi Yorumlar Sekmesi (Premium)
- Yalnızca premium kullanıcıların uygulamaya eklediği yorumlar listelenir
- Her yorum kartında:
  - Kullanıcı adı ve profil fotoğrafı (Google hesabından)
  - 1-5 yıldız puan
  - Yorum tarihi
  - Yorum metni
- **Yorum yazma:** Yalnızca premium kullanıcı yorum ve puan ekleyebilir. Ücretsiz kullanıcıya bu alanda paywall gösterilir.
- Premium kullanıcı kendi yorumunu düzenleyebilir ve silebilir.

#### 7.2.6 "En Kalabalık Saatler" Grafiği (Premium)
- Google Places API'den gelen `popular_times` verisi kullanılır
- Seçili gün için saatlik yoğunluk bar chart formatında gösterilir
- Günler arasında seçim yapılabilir (Pzt, Sal, Çar, vb.)
- Yalnızca premium kullanıcılara gösterilir; ücretsiz kullanıcıya blur + paywall

#### 7.2.7 Aksiyon Butonları
| Buton | Davranış |
|---|---|
| Favoriye Ekle / Çıkar | Dolu/boş kalp ikonu. Tıklanınca favoriler listesine ekler/çıkarır. Ücretsiz kullanıcı 5 limitine ulaşınca paywall gösterilir. |
| Paylaş | Restoran adı, puanı, thumbnail fotoğrafı ve uygulama deep link'ini içeren bir kart oluşturulur. iOS sistem paylaşım menüsü açılır (WhatsApp, Instagram, Mesajlar, vb.) |

---

### 7.3 Favoriler Ekranı

- Alt navigasyon çubuğundaki kalp ikonu ile erişilir.
- Ücretsiz kullanıcı: en fazla 5 restoran, limit dolunca paywall.
- Premium kullanıcı: limitsiz.
- Favori restoranlar kart formatında listelenir (Ana Ekrandaki kart yapısıyla aynı).
- **Çevrimdışı görüntüleme (Premium):** Favori restoranlar lokal cihaz cache'ine kaydedilir; internet bağlantısı olmadan görüntülenebilir. Cache'te saklanan veriler: restoran adı, adres, telefon, çalışma saatleri, puan, mesafe, bir adet thumbnail fotoğraf.

---

### 7.4 Profil & Ayarlar Ekranı

- Google profil fotoğrafı ve adı gösterilir.
- Abonelik durumu gösterilir (Ücretsiz / Premium — bitiş tarihi ile).
- **Premium değilse:** "Premium'a Geç" CTA butonu.
- **Premium ise:** "Aboneliği Yönet" butonu (App Store abonelik yönetimine yönlendirir).
- Yapılan yorumlar listesi (premium kullanıcı için).
- Bildirim tercihleri.
- Gizlilik politikası ve kullanım şartları linkleri.
- Çıkış yap.
- Hesabı sil (GDPR uyumluluğu için zorunlu).

---

### 7.5 iOS Ana Ekran Widget'ı (Premium)

- **Küçük widget (2x2):** Kullanıcının o an en yakınındaki açık restoranı gösterir.
  - Restoran adı
  - Google puanı
  - Tahmini mesafe
- Widget'a tıklanınca uygulama açılır ve doğrudan o restoranın detay ekranına yönlendirilir.
- Konum en son bilinen GPS konumuna göre güncellenir.
- Yalnızca premium kullanıcılara açık.

---

### 7.6 Paywall Ekranı

Ücretsiz kullanıcı premium özelliğe erişmeye çalışınca açılır.

İçerik:
- Premium özelliklerin görsel listesi
- "7 Gün Ücretsiz Dene" ana CTA butonu
- Yıllık plan fiyatı (ön plana çıkarılmış, "En Popüler" etiketi ile)
- Aylık plan fiyatı (ikinci seçenek olarak)
- Kullanım şartları ve gizlilik politikası linki
- Kapat butonu (X ikonu, sağ üst köşe)

---

## 8. Veri Modeli

### 8.1 Tablolar

#### `users`
| Kolon | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| google_id | VARCHAR | Firebase UID |
| email | VARCHAR | Google e-postası |
| display_name | VARCHAR | Google adı |
| photo_url | VARCHAR | Google profil fotoğrafı URL |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| fcm_token | VARCHAR | Push bildirim token'ı |

#### `subscriptions`
| Kolon | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| plan_type | ENUM | 'monthly', 'yearly', 'trial' |
| status | ENUM | 'active', 'cancelled', 'expired', 'trial' |
| started_at | TIMESTAMP | |
| expires_at | TIMESTAMP | |
| iyzico_subscription_id | VARCHAR | İyzico referansı |
| store_transaction_id | VARCHAR | App Store / Play Store referansı |
| created_at | TIMESTAMP | |

#### `favorites`
| Kolon | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| place_id | VARCHAR | Google Places place_id |
| place_name | VARCHAR | Cache'lenmiş restoran adı |
| place_address | VARCHAR | Cache'lenmiş adres |
| place_lat | DECIMAL | Koordinat |
| place_lng | DECIMAL | Koordinat |
| place_phone | VARCHAR | Cache'lenmiş telefon |
| place_photo_url | VARCHAR | Cache'lenmiş thumbnail URL |
| place_rating | DECIMAL | Cache'lenmiş puan |
| created_at | TIMESTAMP | |

#### `reviews` (Uygulama içi yorumlar — sadece premium)
| Kolon | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| place_id | VARCHAR | Google Places place_id |
| rating | SMALLINT | 1-5 |
| body | TEXT | Yorum metni |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `payments`
| Kolon | Tip | Açıklama |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| amount | DECIMAL | Ödeme tutarı |
| currency | VARCHAR | Para birimi (TRY, USD, vb.) |
| iyzico_payment_id | VARCHAR | |
| status | ENUM | 'success', 'failed', 'refunded' |
| created_at | TIMESTAMP | |

---

## 9. API Entegrasyonları

### 9.1 Google Places API

#### Kullanılan Endpoint'ler

**Nearby Search:**
```
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?location={lat},{lng}
  &radius={5000 veya 25000}
  &type=restaurant
  &key={API_KEY}
```

**Place Details:**
```
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={place_id}
  &fields=name,rating,user_ratings_total,formatted_phone_number,
          formatted_address,opening_hours,photos,price_level,
          geometry,types,reviews,popular_times
  &key={API_KEY}
```

**Place Photos:**
```
GET https://maps.googleapis.com/maps/api/place/photo
  ?maxwidth=800
  &photo_reference={photo_reference}
  &key={API_KEY}
```

#### API Maliyet Yönetimi
- Her Nearby Search: $0.032/istek
- Her Place Details: $0.017/istek
- **Redis cache stratejisi:** Aynı `place_id` için Place Details 24 saat cache'lenir; tekrar çağrı yapılmaz.
- Nearby Search sonuçları 1 saat cache'lenir (aynı yaklaşık konum için).
- Fotoğraf URL'leri cache'lenir; tekrar `photo_reference` çözümlenmez.

### 9.2 Google Maps SDK (React Native)
- Harita render için kullanılır.
- `react-native-maps` paketi ile entegre edilir.
- iOS için `GoogleMaps` pod konfigürasyonu yapılır.
- API key, iOS ve Android için ayrı ayrı yapılandırılır.

### 9.3 Firebase Authentication
- `@react-native-google-signin/google-signin` paketi kullanılır.
- Backend'de `firebase-admin` ile token doğrulaması yapılır.

### 9.4 Firebase Cloud Messaging
- Push bildirim gönderimi backend üzerinden `firebase-admin` SDK ile yapılır.
- Kullanıcının `fcm_token`'ı `users` tablosunda saklanır; uygulama açıldığında güncellenir.

---

## 10. Ödeme Sistemi

### 10.1 İyzico Entegrasyonu
- **Abonelik yönetimi:** İyzico'nun abonelik (subscription) API'si kullanılır.
- Ödeme bilgileri (kredi kartı) doğrudan İyzico tarafından işlenir; uygulama kart bilgisi saklamaz.
- İyzico webhook'ları ile abonelik durumu (`active`, `cancelled`, `expired`) güncellenir.

### 10.2 Apple In-App Purchase (iOS)
- App Store kuralları gereği iOS üzerindeki dijital içerik satışları StoreKit 2 üzerinden yapılmalıdır.
- StoreKit 2 ile abonelik satın alma + receipt doğrulama backend'de yapılır.
- İyzico ve StoreKit entegrasyonları paralel çalışır; kullanıcının hangi platformdan ödeme yaptığı `subscriptions` tablosunda `store_transaction_id` kolonuyla izlenir.

### 10.3 Plan Fiyatlandırması
Fiyatlar uygulama yayın öncesi belirlenir. Yapı:
- Aylık plan: X TRY/ay
- Yıllık plan: Y TRY/yıl (%35 indirimli)

---

## 11. Push Bildirimler

| Bildirim Tipi | Tetikleyici | İçerik |
|---|---|---|
| Premium deneme bitiyor | Deneme bitişine 2 gün kala | "Premium denemen 2 gün içinde bitiyor. Devam etmek ister misin?" |
| Premium süresi doldu | Abonelik sona erme günü | "Premium üyeliğin sona erdi. Tekrar başlamak için tıkla." |
| Yeni yüksek puanlı restoran | Backend yeni restoran tespit ettiğinde (opsiyonel) | "Yakınında yeni bir restoran açıldı: {ad} — ★ {puan}" |
| Haftalık özet | Her Pazartesi | "Bu hafta sana en yakın 3 yeni restoran" |

Kullanıcı, Profil > Ayarlar ekranından bildirim tercihlerini yönetebilir.

---

## 12. İş Kuralları & Kısıtlamalar

### 12.1 Konum
- Konum izni verilmezse kullanıcı manuel olarak şehir veya konum girebilir.
- Konum her uygulama açılışında güncellenir; arka planda sürekli izleme yapılmaz (pil tasarrufu).

### 12.2 Ücretsiz Kullanıcı Limitleri
- 5 km yarıçapı sunucu tarafında uygulanır; client-side geçişe izin verilmez.
- 5 favori limiti sunucu tarafında kontrol edilir.
- Uygulama içi yorum yazma isteği backend'de abonelik kontrolünden geçirilir.

### 12.3 Google Places API Bağımlılığı
- Google Places API'nin `popular_times` verisi her restoran için mevcut olmayabilir; bu alan eksikse "Bu restoran için veri bulunmuyor" mesajı gösterilir.
- Google Places API maksimum 5 yorum döner; bu Google'ın bir kısıtıdır ve aşılamaz.

### 12.4 GDPR & Gizlilik
- Kullanıcı verilerinin silinmesi için "Hesabı Sil" seçeneği zorunludur.
- Hesap silindiğinde: `users`, `favorites`, `reviews`, `subscriptions` ve `payments` tablolarındaki kullanıcıya ait tüm veriler silinir veya anonimleştirilir.
- Gizlilik politikası ve kullanım şartları onboarding'de kabul ettirilir.

### 12.5 App Store Kuralları
- iOS'ta dijital abonelik satışı StoreKit 2 üzerinden yapılmalıdır.
- App Store'a gönderimde `NSLocationWhenInUseUsageDescription` ve `NSLocationAlwaysUsageDescription` tanımları `Info.plist`'e eklenmelidir.
- "Apple ile Giriş" kuralı: Eğer uygulamada sosyal giriş sunuluyorsa Apple Sign-In da sunulmalıdır. Google Sign-In tek seçenek olarak bırakılıyorsa bu kural geçerli olmayabilir; Apple App Store Review Guidelines güncel hali kontrol edilmelidir.

---

## 13. İş Önerileri & Büyüme Stratejisi

### 13.1 Kullanıcı Kazanımı

**Paylaşım Mekanizması (Viral Büyüme):**
- Restoran detay ekranındaki "Paylaş" butonu ile restoran adı, puanı, fotoğrafı ve uygulama App Store linki içeren bir kart oluşturulur.
- Bu kart WhatsApp, Instagram Hikayesi ve iOS sistem paylaşım menüsü üzerinden paylaşılabilir.
- Her paylaşım organik kullanıcı kazanımına katkı sağlar.

**Referans Sistemi (V1.1 için öneri):**
- "Arkadaşını davet et, 1 ay premium kazan" kampanyası.
- Kullanıcıya özel referral kodu üretilir; yeni kullanıcı bu kodla kaydolunca her iki tarafa da 30 gün premium verilir.

**ASO (App Store Optimization):**
- Uygulama adı, açıklaması ve anahtar kelimeleri şu terimlere göre optimize edilmeli: "yakınımdaki restoranlar", "restoran bul", "near me restaurants", "en yakın restoran", "restaurant finder".
- Ekran görüntüleri: Ana ekran (liste), harita görünümü, restoran detayı (telefon + yol tarifi), premium paywall.

### 13.2 Gelir Optimizasyonu

**Paywall Zamanlaması (Dönüşüm Noktaları):**
Paywall şu anlar gösterilir:
1. Kullanıcı 5. favorisini eklemeye çalıştığında
2. Uygulama içi yorum yazmaya çalıştığında
3. "En kalabalık saatler" bölümüne tıkladığında
4. Onboarding'in 3. ekranında

**Yıllık Plan Vurgusu:**
- Paywall ekranında yıllık plan "En Popüler" etiketi ile ön plana çıkarılır.
- Aylık plan maliyet karşılaştırması gösterilir: "Ayda X TRY yerine Y TRY."

**Ücretsiz Deneme:**
- 7 günlük deneme, kullanıcının premium özellikleri "alışkanlık haline getirmesini" sağlar.
- Deneme bitiminde otomatik ücretlendirme yapılmaz; açık onay alınır. Bu App Store politikası ile de uyumludur.

### 13.3 Kullanıcı Bağlılığı (Retention)

**Push Bildirimler:**
- Bağlamsal bildirimler (kalabalık saatler, yeni restoran) kullanıcıyı tekrar uygulamaya çeker.
- Haftalık özet bildirimi düşük yoğunluklu ama sürekli bir hatırlatıcı görevi görür.

**Çevrimdışı Favori:**
- İnternet yokken bile favorilere bakılabilmesi, uygulamanın günlük alışkanlığa dönüşmesini kolaylaştırır.

**Widget:**
- iOS ana ekranındaki widget, kullanıcının her telefon kilidini açtığında uygulamayı hatırlamasını sağlar.

### 13.4 B2B Gelir Kanalı (V2 için)
- Restoran sahibi paneli aracılığıyla restoranlar öne çıkarma, banner veya kampanya için ücretli paket satın alabilir.
- Bu, kullanıcı tabanı büyüdükçe güçlü bir B2B gelir akışına dönüşebilir.

---

## 14. V2 Kapsamı

Aşağıdaki özellikler V1'e dahil değildir; bir sonraki versiyonda ele alınacaktır:

| Özellik | Açıklama |
|---|---|
| Android desteği | React Native sayesinde büyük ölçüde kod paylaşımı yapılabilir |
| Restoran sahibi paneli | Profil düzenleme, fotoğraf yükleme, kampanya oluşturma, uygulama içi yorumlara yanıt verme |
| Rota optimizasyonu | Birden fazla restoran seçilince en verimli ziyaret sırası |
| Arkadaş listeleri | Kullanıcılar arası favori liste paylaşımı ("Arkadaşlarımın önerileri") |
| Referral sistemi | Davet et & kazan mekanizması |
| Apple Sign-In | App Store gerekliliklerine göre değerlendirme |

---

## 15. Yayın Planı

| Aşama | Kapsam | Hedef |
|---|---|---|
| Alpha | Konum, Nearby Search, Liste & Harita görünümü, Restoran Detay | İç test |
| Beta | Google Sign-In, Favoriler, Sıralama & Filtreleme, Paywall | TestFlight |
| V1.0 | Premium abonelik (İyzico + StoreKit), Push bildirimler, Widget | App Store |
| V1.1 | Android desteği, Performans iyileştirmeleri | Play Store |
| V2.0 | Restoran sahibi paneli, Referral sistemi | — |

---

*Bu doküman NearEat uygulamasının V1 geliştirme kapsamını ve teknik gereksinimlerini tanımlar. Tüm özellikler öncelik sırasına göre sprint'lere bölünerek geliştirilecektir.*

*Doküman Tarihi: Nisan 2026*
*Versiyon: 1.0*
