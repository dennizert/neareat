# Expo SDK Yükseltmesi — Smoke-Test Kontrol Listesi

> EPIC #497 · Faz 0 (#498) çıktısı
> **Her fazda BAŞTAN SONA, birebir aynı sırayla koşulur.** Amaç fazları
> karşılaştırılabilir kılmak — her seferinde farklı şeyler denenirse
> "bu faz iyi mi kötü mü?" sorusu cevapsız kalır.

## Bu liste neden var?

`npm test` 577 test ile yeşil, ama **kod tabanı satır kapsamı %22,34** ve
**`screens/` kapsamı %2,31** (bkz. `UPGRADE_BASELINE.md`). Yani bir SDK
yükseltmesinin en çok bozduğu yer (render, layout, native davranış) tam olarak
otomatik testin olmadığı yer. **Yeşil test paketi, ekranların çalıştığına dair
kanıt değildir.**

## Nasıl kullanılır

- Liste ekran ekran değil, **native yüzeye göre** gruplanmıştır. 54 ekranı tek tek
  tıklamak yerine, her native yüzeyi en az bir kez tetikleyen en kısa yol seçilir.
- **Hedef süre: tam tur ≤45 dakika.** Bu süre aşılıyorsa liste kısaltılır
  (madde **silinmez**, birleştirilir) — aksi halde liste fiilen terk edilir.
- Her faz için bu dosyanın bir kopyası alınıp sonuçlar işaretlenir, ya da faz
  PR'ında sonuç tablosu paylaşılır.

### Durum kodları
| Kod | Anlamı |
|---|---|
| ✅ | Çalışıyor |
| ❌ | Kırık — **bu fazda** kırıldı (regresyon) |
| ⚠️ | Kırık ama **yükseltmeden önce de kırıktı** (regresyon DEĞİL) |
| ⏭️ | Bu ortamda doğrulanamadı (sebep yazılır) |

---

## Ortam kurulumu ve bilinen tuzaklar

Ölçüm/doğrulama öncesi **her seferinde**:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
```

### ⚠️ Tuzak 1 — Türkçe karakterli yol release build'i KIRIYOR
Depo `…/Deniz Kişisel/…` altında; bu yoldan `assembleRelease` çalışmıyor
(`Unable to resolve module expo/AppEntry.js`). **Release build'ler ASCII bir yoldan
alınmalı** (worktree). Ayrıntı: `UPGRADE_BASELINE.md` → B1.

### ⚠️ Tuzak 2 — Metro `/status` ucu da aynı sebepten bozuk
Debug APK + Metro akışı Türkçe yoldan "Unable to load script" veriyor. Metro'yu ASCII
yoldan başlat + `adb reverse tcp:8081 tcp:8081`.

### ⚠️ Tuzak 3 — Headless emülatörde GPS hiç konum üretmiyor
`adb emu geo fix` "OK" dese de konum teslim edilmiyor; `getCurrentPositionAsync`
~30 sn sonra reddediyor. **Konum bağımlı maddeler (C grubu) gerçek cihazda doğrulanmalı.**

### ⚠️ Tuzak 4 — Yükseltme sonrası Metro cache'i MUTLAKA temizlenmeli
`npx expo start --clear`. Aksi halde eski modül girişleri sessizce `undefined` döner
(expo-location 17→18'de yaşandı, kütüphane hatası sanıldı).

### ⚠️ Tuzak 5 — `SENTRY_AUTH_TOKEN` olmadan release build kırılıyor
Doğrulama build'lerinde `SENTRY_DISABLE_AUTO_UPLOAD=true` kullan. Ayrıntı: `UPGRADE_BASELINE.md` → B3.

### Kurulum komutları
```bash
# Temiz kurulum (CI ile aynı)
npm ci

# Release build (ASCII yoldan!)
cd android && SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease

# Kurulum + açılış
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.eatlas.mobile/.MainActivity

# Soğuk başlangıç ölçümü (5 kez, medyan al)
adb shell am force-stop com.eatlas.mobile && sleep 2
adb shell am start -W -n com.eatlas.mobile/.MainActivity | grep TotalTime

# Crash kontrolü
adb logcat -d | grep -iE "FATAL|AndroidRuntime.*Exception"
```

---

## A. Uygulama yaşam döngüsü

| # | Kontrol | Durum |
|---|---|---|
| A1 | Soğuk başlangıç: uygulama açılıyor, splash görünüyor, crash yok | |
| A2 | Arka plana alıp geri getirme → abonelik yeniden yükleniyor (`App.tsx` `AppState`) | |
| A3 | Uygulama kapatılıp açıldığında oturum korunuyor (`SecureStore` + `restoreSession`) | |
| A4 | Zustand persist: son restoran listesi **anında** geliyor, iskelet ekran yanıp sönmüyor | |

## B. Kimlik doğrulama 🔴 (en yüksek iş riski)

| # | Kontrol | Durum |
|---|---|---|
| B1 | **Google ile giriş** (birincil yöntem) | |
| B2 | Google kullanıcısı uygulamayı kapatıp açınca **sessizce geri yükleniyor** (`signInSilently`) | |
| B3 | E-posta ile kayıt → doğrulama e-postası → `neareat://` deep link ile dönüş | |
| B4 | E-posta + şifre ile giriş | |
| B5 | Şifremi unuttum → sıfırlama linki → yeni şifreyle giriş | |
| B6 | Çıkış yap → token siliniyor, login ekranına dönülüyor | |
| B7 | Süresi dolmuş oturumda 401 → otomatik çıkış (A02 oturum-nesli) | |

## C. Konum ve harita

| # | Kontrol | Durum |
|---|---|---|
| C1 | Konum izni isteme akışı (`LocationPermissionScreen`) | |
| C2 | Keşfet listesi konuma göre yükleniyor | |
| C3 | Harita açılıyor, pin'ler + kümeleme çalışıyor | |
| C4 | Pin'e dokunma → alt önizleme kartı + hızlı favorileme | |
| C5 | Rota önerisi ekranı | |

> ⚠️ C2–C5 **gerçek cihaz** gerektirir (Tuzak 3).

## D. Ağ katmanı ve AI akışı 🔴

| # | Kontrol | Durum |
|---|---|---|
| D1 | REST çağrıları (axios + Bearer header + 401 interceptor) | |
| D2 | **AI öneri SSE streaming** — kartlar tek tek akıyor (`expo/fetch` + `getReader()`) | |
| D3 | SSE akışını iptal etme (`AbortController`) | |
| D4 | Konuşmaya dayalı iyileştirme ("daha ucuz") → `sessionId` ile yeni öneri | |
| D5 | Çevrimdışı: uçak modunda önbellekten liste/favoriler geliyor | |

> ⚠️ SDK 56'dan itibaren `expo/fetch` **global `fetch`'in varsayılanı** olacak → D2/D3 her fazda tekrar koşulmalı.

## E. Bildirimler

| # | Kontrol | Durum |
|---|---|---|
| E1 | Bildirim izni isteme | |
| E2 | Uygulama içi bildirim listesi ve zil rozeti (`NotificationBell`) | |
| E3 | Bildirime dokunma → doğru ekrana deep link | |
| E4 | Bildirim tercihleri kaydediliyor | |

## F. Medya ve dosya

| # | Kontrol | Durum |
|---|---|---|
| F1 | Profil fotoğrafı seçme + boyutlandırma | |
| F2 | **Restoran menü/ürün fotoğrafı yükleme** → S3 presigned PUT (`uploadPhotoToS3`) | |
| F3 | Fotoğraf analizi (AI) akışı | |

> ⚠️ F2 doğrudan global `fetch` ile `file://` okuyor → SDK 56'da kritik.

## G. Ödeme 🔴

| # | Kontrol | Durum |
|---|---|---|
| G1 | Paywall'da **gerçek Play Store fiyatı** görünüyor (fallback metin DEĞİL) | |
| G2 | Satın alma başlıyor, Google Play ödeme sayfası açılıyor | |
| G3 | Test satın alması tamamlanıyor → backend doğruluyor → "Premium Aktif" | |
| G4 | Tamamlanmamış satın alma kurtarma (`getAvailablePurchases`) | |

> ⚠️ Bu grup **Faz 7'nin ön koşulu**: yükseltmeden ÖNCE en az bir kez yeşil olmalı,
> aksi halde "yükseltme mi bozdu?" sorusu cevapsız kalır.

## H. UI altyapısı

| # | Kontrol | Durum |
|---|---|---|
| H1 | `EatlasLogo` gradyanı doğru render ediliyor (linear-gradient + masked-view) | |
| H2 | Haptic geri bildirim çalışıyor (`PressableScale`) | |
| H3 | Karanlık/aydınlık tema geçişi | |
| H4 | Uzun listelerde kaydırma takılmıyor | |
| H5 | **Güvenli alan**: içerik durum/navigasyon çubuğu altına taşmıyor | |
| H6 | Modal'lar doğru açılıp kapanıyor (`PrivacyPolicyModal`, `NotificationBell`) | |

> ⚠️ H5 **Faz 5'te (edge-to-edge zorunlu) kritik** — o fazda tüm navigasyon kabukları tek tek gezilir.

## I. Rol bazlı akışlar

| # | Kontrol | Durum |
|---|---|---|
| I1 | **Kullanıcı**: 5 sekme, favori ekle/çıkar, liste oluştur, rezervasyon, arkadaş ekle, mesaj | |
| I2 | **Restoran**: panel, rezervasyon onaylama (koltuk girişi), doluluk paneli, kampanya, analitik, menü | |
| I3 | **Admin**: panel, kullanıcı/restoran yönetimi, loglar | |

## J. Gözlemlenebilirlik

| # | Kontrol | Durum |
|---|---|---|
| J1 | Kasıtlı hata → Sentry'ye düşüyor (`ErrorBoundary` → `captureException`) | |
| J2 | Sentry'deki stack trace **okunabilir** (source map upload çalışıyor — #491) | |
| J3 | Analytics event'leri backend'e ulaşıyor (`/analytics/events` — #481) | |

---

## Faz 0 — ilk koşu sonuçları (SDK 52, 2026-09-21)

Liste, yükseltmeden **önce** mevcut sürüm üzerinde koşularak kendi doğruluğunu kanıtladı.

### Otomatik/emülatörde doğrulananlar

| # | Sonuç | Kanıt |
|---|---|---|
| A1 | ✅ | Release APK emülatöre kuruldu, açıldı, onboarding ekranı render edildi, `logcat`'te FATAL yok. Soğuk başlangıç medyanı **358 ms** |
| H5 | ✅ | Açılış ekranı görüntüsünde durum çubuğu ve alt gezinme çubuğu içeriğe binmiyor |
| — | ✅ | `npm test` 577/577 · ESLint 0 hata · `tsc --noEmit` temiz |

### ⏭️ Bu ortamda doğrulanamayanlar (gerçek cihaz / hesap / Play Store gerekiyor)

| Grup | Sebep |
|---|---|
| B1–B7 | Gerçek Google hesabı + e-posta erişimi gerekiyor |
| C1–C5 | Emülatörde GPS konum üretmiyor (Tuzak 3) |
| D1–D5 | Canlı backend'e karşı test verisi üretmemek için atlandı |
| E1–E4 | FCM push altyapısı ve gerçek cihaz gerekiyor |
| F1–F3 | Kamera/galeri erişimi |
| G1–G4 | ⚠️ **Play Store üzerinden kurulum gerekiyor** — ayrıca Play Console kurulumu (abonelik ürünü, lisanslı test hesabı, upload key sıfırlama) **henüz tamamlanmadı** |
| I1–I3 | Üç rol için de gerçek hesaplar gerekiyor |
| J1–J3 | Sentry/analytics doğrulaması canlı servis gerektiriyor |

### ⚠️ Yükseltme ÖNCESİ zaten bilinen kırıklık

| # | Durum | Not |
|---|---|---|
| G1–G4 | ⚠️ **Hiç doğrulanmadı / muhtemelen kırık** | #493'te `expo-iap`'in gerektirdiği native bağımlılıkların (`billing-ktx`, `play-services-base`) `android/build.gradle`'a hiç enjekte edilmemiş olduğu bulundu ve düzeltildi, ama akış **hâlâ uçtan uca test edilmedi**. Play Console tarafı da eksik. **Sonraki fazlarda G grubu kırık çıkarsa bu yükseltmeye atfedilmemelidir.** |

> **Sonuç:** Liste yapısal olarak doğrulandı ve mevcut durumun fotoğrafı çekildi.
> Manuel grupların tam koşusu, gerçek cihaz erişimi olan geliştirici tarafından
> **Faz 1'e geçmeden önce** yapılmalıdır.
