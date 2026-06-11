# Faz-2 Kalan Adımlar — Play Store & IAP

Son güncelleme: 2026-06-10

---

## DURUM ÖZETİ

| Adım | Konu | Durum |
|------|------|-------|
| 1 | Google Sign-In düzeltmesi (Firebase + google-services.json) | BEKLIYOR |
| 2 | Google Cloud Service Account kurulumu | BEKLIYOR |
| 3 | RTDN Pub/Sub kurulumu | BEKLIYOR |
| 4 | Yeni AAB build + Play Console yükleme | BEKLIYOR (1-3 sonrası) |
| 5 | Play Console App Content tamamlama | BEKLIYOR |
| 6 | Kapalı test başlatma (14 gün) | BEKLIYOR |
| 7 | Abonelik ürünleri oluşturma | BLOCKED (şahıs şirketi gerekli) |
| 8 | Şahıs şirketi açma | BEKLIYOR |
| 9 | Android sistem navbar bottom inset düzeltmesi (tüm ekranlar) | KOD DÜZENLENDI — yeni AAB gerekli |

---

## TEST BULGULARI (2026-06-10)

Test kullanıcısı olarak Play Store kapalı test kanalından indirilen AAB üzerinde tespit edilen sorunlar:

### Kritik
- **Google ile Giriş çalışmıyor** — `google-services.json` paketi `com.neareat.app`, uygulama paketi `com.eatlas.mobile`. (Adım 1 ile çözülecek)

### UI/UX
- **Android system navigation bar (alt gezinme çubuğu) uygulama içeriğini kapatıyor** — Scroll listelerin son satırları, butonlar ve yazılar alt gezinme çubuğunun arkasında kalıyor. 35+ ekranın büyük çoğunluğu `useSafeAreaInsets` kullanmıyor.
  - Etkilenen ekran örnekleri: Yorumlar listesi (RestaurantDetail), Yıldızlarım & Ödüller, tüm liste ekranları
  - Düzeltme: `ScreenScrollView` paylaşımlı bileşeni oluşturuldu, kritik ekranlar güncellendi (kod değişikliği var — yeni AAB build gerekli)

---

## ADIM 1 — Google Sign-In Düzeltmesi

**Sorun:** `google-services.json` eski paket adıyla (`com.neareat.app`) kayıtlı.
Uygulamanın gerçek paketi `com.eatlas.mobile` olduğu için Firebase Google Sign-In çalışmıyor.
Ayrıca Play Store'dan indirilen AAB, Google Play App Signing ile yeniden imzalandığından
Play imza SHA-1'i de Firebase'e eklenmeli.

### 1a — Play Console'dan imza SHA-1'ini al

1. Play Console → Eatlas uygulaması → Sol menü → **Kurulum → Uygulama bütünlüğü**
2. "Uygulama imzalama anahtarı sertifikası" bölümünde **SHA-1 sertifika parmak izi**ni kopyala
   - Örnek format: `AB:CD:12:...`

### 1b — Firebase'e yeni Android uygulaması ekle

1. Firebase Console → https://console.firebase.google.com → `neareat-becb6` projesi
2. Proje Ayarları (sol altta çark ikonu) → **Genel** sekmesi
3. "Uygulamalarınız" bölümüne in → **Android uygulaması ekle**
4. Paket adı: `com.eatlas.mobile`
5. Uygulama takma adı: `Eatlas`
6. **SHA-1 ekle** — 3 tane gireceksin:

| SHA-1 | Kaynak |
|-------|--------|
| `E2:5C:EC:22:D2:0A:22:F9:63:3D:96:D9:26:95:7B:83:E8:49:20:0E` | Upload keystore (neareat-upload.keystore) |
| `F3:EA:A3:A7:2D:EF:3A:B6:50:5A:53:5B:4D:2F:D8:92:C6:A1:AE:14` | Debug keystore (yerel geliştirme) |
| Play App Signing SHA-1 (adım 1a'dan) | Play Store dağıtımı |

7. Uygulamayı kaydet → **`google-services.json` indir**

### 1c — google-services.json'u projeye ekle

İndirdiğin dosyayı şu konuma koy:
```
neareat-mobile/android/app/google-services.json
```

Sonra bana "google-services.json hazır" de — dosyayı kontrol edip yeni AAB build alacağım.

---

## ADIM 2 — Google Cloud Service Account

IAP satın alma doğrulaması için backend'in Google Play API'ye erişmesi gerekiyor.

### 2a — Google Cloud Projesi oluştur

1. https://console.cloud.google.com → Yeni Proje
2. Proje adı: `eatlas-play-api`
3. Proje oluşturulduktan sonra o projeyi seç

### 2b — Google Play Android Developer API'yi etkinleştir

1. Sol menü → **API'ler ve Hizmetler → Kitaplık**
2. "Google Play Android Developer API" ara → **Etkinleştir**

### 2c — Hizmet Hesabı oluştur

1. Sol menü → **IAM ve Yönetici → Hizmet Hesapları**
2. **Hizmet Hesabı Oluştur**
   - Ad: `eatlas-play-backend`
   - Rol: **Düzenleyici** (Editor) — ya da daha kısıtlı için "Hizmet Hesabı Simge Dizisi Oluşturucu"
3. Oluşturulan hesabı tıkla → **Anahtarlar** sekmesi → **Anahtar Ekle → JSON**
4. JSON dosyası otomatik indirilir — güvenli bir yere kaydet

### 2d — Hizmet Hesabını Play Console'a bağla

1. Play Console → Sol alt → **Kurulum → API erişimi**
2. Google Cloud projesini bağla (2a'da oluşturduğun proje)
3. Hizmet hesaplarını yönet → `eatlas-play-backend`'i bul → **İzin ver**
4. Yetki: en az **Finans verilerini görüntüle** + **Siparişleri ve abonelikleri yönet**

### 2e — Railway'e env var ekle

Railway dashboard → neareat-backend servisi → Variables:

```
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"eatlas-play-api",...}
GOOGLE_PLAY_PACKAGE_NAME=com.eatlas.mobile
```

JSON dosyasının tüm içeriğini tek satır olarak `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` değerine yapıştır.

---

## ADIM 3 — RTDN Pub/Sub Kurulumu

RTDN (Real-time Developer Notifications): abonelik durumu değiştiğinde
Google Play, backend'e anlık bildirim gönderir.

### 3a — Pub/Sub konusu oluştur

1. Google Cloud Console → `eatlas-play-api` projesi
2. Sol menü → **Pub/Sub → Konular**
3. **Konu Oluştur** → Konu kimliği: `play-rtdn`
4. Oluştur

### 3b — Push aboneliği oluştur

1. `play-rtdn` konusunu tıkla → **Abonelikler** sekmesi → **Abonelik Oluştur**
2. Abonelik türü: **Push**
3. Endpoint URL: `https://railway-up-production-6cdc.up.railway.app/webhooks/google-play`
4. Kimlik doğrulama: **Hizmet hesabı** → `eatlas-play-backend` seç
5. Oluştur

### 3c — Play Console'da RTDN'yi etkinleştir

1. Play Console → Kurulum → API erişimi
2. "Gerçek zamanlı geliştirici bildirimleri" → **Konu adını güncelle**
3. Konu adı formatı: `projects/eatlas-play-api/topics/play-rtdn`

---

## ADIM 4 — Yeni AAB Build + Yükleme

Adım 1-3 tamamlandıktan sonra:

1. `google-services.json` güncellendi (adım 1c)
2. Proje dizininde:
```bash
cd neareat-mobile/android
./gradlew bundleRelease
```
3. Çıktı: `neareat-mobile/android/app/build/outputs/bundle/release/app-release.aab`
4. Play Console → Test edin ve yayınlayın → İç test → Yeni sürüm → AAB yükle
5. versionCode artır (şu an 30 → 31 yap), versionName "2.0.3"

---

## ADIM 5 — Play Console App Content Tamamlama

Sol menü → **Politika → Uygulama İçeriği**:

### İçerik Derecelendirmesi
- Anketi doldur: yiyecek/içecek uygulaması, şiddet/müstehcenlik yok
- Beklenen sonuç: PEGI 3 / Everyone

### Veri Güvenliği
Toplanan ve işlenen veriler:
- **Ad ve e-posta** — Hesap yönetimi için, şifreli, üçüncü tarafla paylaşılmıyor
- **Konum** — Yakındaki restoranları bulmak için, yalnızca uygulama kullanılırken
- **Kullanıcı içeriği** (yorumlar, favoriler) — Uygulama işlevselliği için, şifreli
- **Uygulama aktivitesi** (tıklama, arama geçmişi) — Kişiselleştirme için

"Veriler şifrelenerek iletilir" → Evet
"Veri silme talebi" → Evet (hesap-silme sayfamız var)

### Hedef Kitle
- Yaş grubu: 18+
- Çocuklara yönelik değil

### Reklam
- Uygulama reklam içeriyor mu? → Hayır

---

## ADIM 6 — Kapalı Test Başlatma

1. Sol menü → **Test edin ve yayınlayın → İç test**
2. Test kullanıcılarını kontrol et (en az 1, test e-posta adresi)
3. **İncelemeye gönder** → Google birkaç saat içinde onaylar
4. Onay sonrası test bağlantısı aktif olur

**Not:** Kapalı testten açık yayına geçmek için 14 gün bekleme gerekiyor (Google politikası).
Test etmeye hemen başla ki süre dolsun.

---

## ADIM 7 — Abonelik Ürünleri (BLOCKED)

**Bloker:** Bireysel hesap + Türkiye kombinasyonu Google Play ödemelerini desteklemiyor.
Şahıs şirketi kurulup Google Payments'a eklenmesi gerekiyor.

Ürünler hazırlandığında oluşturulacaklar:
- `premium_monthly` → 79,99 TRY / ay
- `premium_yearly` → 599,99 TRY / yıl (2 ay bedava)

---

## ADIM 8 — Şahıs Şirketi

Play Store'dan ödeme alabilmek için Türkiye'de vergi mükellefi olmak zorunlu.

Süreç özeti:
1. Bağlı bulunduğun vergi dairesine şahıs şirketi başvurusu
2. Vergi levhası al
3. Google Play Console → Ödemeler → Ödeme profili düzenle → Hesap türü: Bireysel işletme
4. Türkiye seç, vergi kimlik numarası gir
5. Şirket bilgilerini gir

Şirket kurulduktan sonra mevcut bireysel Play Console hesabını kurumsal profile yükseltmek için
Support ile iletişime geç — yeni hesap açmak gerekmez.

Sonraki uygulama güncellemeleri için:
- Yeni AAB build al (versionCode artır)
- Play Console → İç test → Yeni sürüm yükle
- Mevcut test kullanıcıları otomatik güncelleme alır

---

## KRITIK YEDEKLEME NOTU

`neareat-mobile/android/app/neareat-upload.keystore` dosyası `.gitignore`'da!
Bu dosyayı kaybedersen Play Store'a yükleme yapamayabilirsin.
**OneDrive veya Google Drive'a yedekle.**

Keystore bilgileri:
- Dosya: `neareat-upload.keystore`
- Alias: `neareat`
- Store şifre: `NearEat2024Upload!`
- Key şifre: `NearEat2024Upload!`
