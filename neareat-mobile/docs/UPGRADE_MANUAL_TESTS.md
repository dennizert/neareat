# Expo SDK Yükseltmesi — Adım Adım Manuel Test Rehberi

> EPIC #497 · Faz 1a'dan Faz 4'e kadar olan tüm değişiklikleri kapsar.
> Fazlar tek tek test edilmeden merge edildi; **bu doküman o testlerin tamamını** içerir.
>
> Bu rehber "neye bakılacak"ı değil, **"nasıl bakılacak"ı** anlatır. Her testte
> hangi ekrana nasıl gidileceği, neyin doğru neyin yanlış olduğu yazılıdır.

---

## 0. Hazırlık

### 0.1 Neye ihtiyacın var

- Android telefon (tercihen gerçek cihaz — emülatörde GPS ve ödeme test edilemez)
- USB kablosu **veya** APK'yı telefona aktarmanın başka bir yolu (Drive, e-posta)
- Bir Eatlas hesabı (Google ile giriş yapabildiğin)
- ~45–60 dakika

### 0.2 Test edeceğin APK

Her faz için ayrı bir APK arşivlendi:

| Dosya | İçerik |
|---|---|
| `~/eatlas-upgrade-archive/eatlas-sdk52-pre-faz1-v2.0.14-vc42.apk` | **Yükseltme öncesi** — karşılaştırma için referans |
| `~/eatlas-upgrade-archive/eatlas-faz2-sdk53.apk` | SDK 53 |
| `~/eatlas-upgrade-archive/eatlas-faz3-sdk54.apk` | SDK 54 |
| `~/eatlas-upgrade-archive/eatlas-faz4-newarch.apk` | SDK 54 + Yeni Mimari |
| `~/eatlas-upgrade-archive/eatlas-faz5-sdk55.apk` | **SDK 55 + edge-to-edge** ← *önce bunu test et* |

> **Neden önce en sonuncusu:** Hepsi birikimli. `faz4` APK'sı tüm fazları içeriyor.
> Her şey çalışıyorsa diğer APK'ları kurmana **hiç gerek yok**. Bir sorun çıkarsa
> §5'teki "hangi faz bozdu" yöntemine geçersin.

### 0.3 APK'yı telefona kurma

**Yol A — USB ile (önerilen).** Telefonda *Ayarlar → Telefon hakkında → Yapı
numarası*na 7 kez dokun (geliştirici modu açılır), sonra *Ayarlar → Geliştirici
seçenekleri → USB hata ayıklama*yı aç. Telefonu bağla, bilgisayarda:

```bash
export PATH="$PATH:/opt/homebrew/share/android-commandlinetools/platform-tools"
adb devices          # telefonun listede görünmeli ("device" yazmalı)
adb install -r ~/eatlas-upgrade-archive/eatlas-faz4-newarch.apk
```

`Success` görmelisin.

> ⚠️ `adb devices` telefonu "unauthorized" gösterirse telefonun ekranına bak —
> "Bu bilgisayara izin ver?" diyaloğunu onaylaman gerekiyor.

**Yol B — dosya olarak.** APK'yı Drive'a yükle, telefondan indir, dosya
yöneticisinden aç. "Bilinmeyen kaynaklara izin ver" sorusuna evet de.

### 0.4 Önemli: mevcut uygulamanın üstüne kur, SİLME

`adb install -r`'deki `-r` "replace" demek — uygulama verisi (oturum, tercihler)
**korunur**. Bu bilerek böyle: **Test 1c-1 tam olarak bunu ölçüyor.**

Eğer `INSTALL_FAILED_UPDATE_INCOMPATIBLE` hatası alırsan imzalar uyuşmuyor
demektir; o zaman `adb uninstall com.eatlas.mobile` gerekir — ama bu **veriyi
siler** ve 1c-1'i artık test edemezsin. Bu durumda 1c-1'i "⏭️ test edilemedi"
olarak işaretle.

### 0.5 Sonuçları nasıl kaydet

Her satırın sonundaki **Durum** sütununa yaz:

| İşaret | Anlamı |
|---|---|
| ✅ | Çalıştı |
| ❌ | Kırık — **ne gördüğünü yaz** ("harita gri kaldı", "uygulama kapandı") |
| ⚠️ | Çalıştı ama tuhaf — neyin tuhaf olduğunu yaz |
| ⏭️ | Test edemedim — nedenini yaz |

❌ veya ⚠️ işaretlersen **ekran görüntüsü al** (güç + ses kısma tuşu).

### 0.6 Uygulama çökerse ne yapmalısın

Çökme anını yakalamak çok değerli. Telefon USB ile bağlıyken:

```bash
adb logcat -c                                   # geçmişi temizle
# ——— şimdi telefonda çökmeye sebep olan şeyi yap ———
adb logcat -d > ~/Desktop/eatlas-crash.txt      # kaydı masaüstüne al
```

Bu dosyayı bana ver, çökmenin sebebini oradan okuyabilirim.

---

## 1. Öncelik sırası

Zamanın kısıtlıysa yukarıdan aşağı git. En üsttekiler hem en çok iş riski taşıyor
hem de değişiklikten en çok etkilenen yerler.

1. **§3.5 Harita** — Yeni Mimari'nin en riskli noktası (statik analizle belirlendi)
2. **§3.8 Edge-to-edge** — SDK 55'te zorunlu oldu, her kabuğun kenarları
2. **§2.1 Google ile giriş + oturum koruma** — kütüphane sözleşmesi değişti
3. **§3.1 İkonlar** — Faz 2'de tamamen kaybolmuştu, düzeltildi
4. **§3.6 Ödeme / paywall** — çalışmazsa plan değişecek
5. **§2.2 Navigasyon geri tuşu** — `navigate` → `popTo` değişimi
6. Geri kalanlar

---

## 2. Faz 1 testleri (kütüphane ana sürüm atlamaları)

### 2.1 🔴 Google ile giriş ve oturum koruma

**Neden kritik:** `google-signin` v13+ sözleşmesini değiştirdi. Eskiden kullanıcı
iptal ettiğinde **hata fırlatıyordu**; artık `{ type: 'cancelled' }` **döndürüyor**.
Aynı şekilde "kayıtlı hesap yok" durumu da artık hata değil. Kod bu yeni sözleşmeye
göre yeniden yazıldı — yanlış yazılsaydı uygulama oturumu **yanlışlıkla açık
sayardı.**

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 1a-1 | Uygulamayı aç → giriş ekranı → **Google** sekmesi → Google ile giriş | Google hesap seçici açılır, hesabı seçince giriş olur ve ana ekrana düşer | |
| 1a-2 | Çıkış yap. Tekrar Google girişini başlat, hesap seçici açılınca **geri tuşuna bas** (iptal et) | Giriş ekranında kalır, kısa bir hata/uyarı mesajı görünür. **Çökmemeli, sonsuza kadar "yükleniyor"da kalmamalı** | |
| 1a-3 | Google ile giriş yap. Uygulamayı **tamamen kapat**: son uygulamalar ekranını aç (kare tuşu / alttan yukarı kaydırıp bekle), Eatlas kartını yukarı kaydırıp at. Sonra tekrar aç | **Oturum açık gelmeli** — tekrar giriş istememeli | |
| 1a-4 | Uygulamadan **çıkış yap**, sonra 1a-3'teki gibi tamamen kapat, tekrar aç | Giriş ekranı gelmeli. **Kendiliğinden içeri girmemeli** | |

> 1a-4 bu göçün en tehlikeli noktası. Kod yanlış olsaydı belirti tam olarak şu
> olurdu: çıkış yaptın ama uygulama seni yine içeride sanıyor.

### 2.2 Navigasyon — geri tuşu davranışı

**Neden:** React Navigation v7'de `navigate()` artık yığındaki mevcut ekrana
**geri dönmüyor**, üstüne bir kopya itiyor. İki yerde `popTo()` ile değiştirildi.
Yanlış olsaydı belirti: geri tuşuna bastığında **az önce bitirdiğin ekrana geri
dönerdin**.

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 1b-1 | Rezervasyonlarım → bir rezervasyon seç → **Düzenle** → bir şeyi değiştir → Kaydet | "Rezervasyonlarım" listesine döner. Şimdi **geri tuşuna bas**: uygulamadan çıkmalı veya bir önceki sekmeye gitmeli — **düzenleme ekranına DÖNMEMELİ** | |
| 1b-2 | Giriş ekranı → Şifremi Unuttum → e-postana gelen bağlantıya **uygulama açıkken** tıkla → yeni şifre belirle → "Giriş Yap" | Giriş ekranına döner. **Geri tuşu, kullanılmış şifre sıfırlama ekranına dönmemeli** | |
| 1b-3 | Alt sekmeler arasında 5–6 kez gezin, sonra geri tuşuna arka arkaya bas | Mantıklı şekilde geriye gider; **aynı ekran üst üste tekrar tekrar çıkmamalı** | |

### 2.3 Veri saklama (AsyncStorage 1 → 2)

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 1c-1 | *(Sadece §0.4'teki gibi üstüne kurduysan geçerli)* Uygulamayı aç | **Onboarding ekranları tekrar çıkmamalı**, eski tercihlerin durmalı | |
| 1c-2 | Bir tercih değiştir (tema, bildirim ayarı vb.) → uygulamayı tamamen kapat → aç | Ayar korunmuş olmalı | |

### 2.4 Güvenli alan (çentik / gezinme çubuğu)

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 1d-1 | Tüm alt sekmeleri tek tek gez, her birinin **en üstüne** bak | Başlıklar saat/pil simgelerinin **altında** olmalı, üstüne binmemeli | |
| 1d-2 | Aynı ekranların **en altına** bak | Butonlar telefonun alt çubuğunun altında kalmamalı, rahat tıklanmalı | |
| 1d-3 | Telefonu yan çevir (dönme açıksa) | Kenar boşlukları düzgün güncellenmeli | |

---

## 3. Faz 2–4 testleri (SDK 53 → 54 → Yeni Mimari)

### 3.1 🔴 İkonlar — her ekranda

**Neden kritik:** Faz 2'de uygulamadaki **tüm ikonlar görünmez olmuştu**.
Sebep bir bağımlılığın sessizce ağaçtan düşmesiydi; düzeltildi ve bir regresyon
testi eklendi. Yine de gözle doğrulanması gerekiyor — çünkü otomatik testler
ekranları render etmiyor.

**Nasıl bakılır:** Aşağıdaki ekranları aç ve **ikonların yerinde boşluk olup
olmadığına** bak. Bozuksa ikon hiç çizilmez (boşluk) veya soru işareti çıkar.

| # | Ekran | Görmen gereken ikonlar | Durum |
|---|---|---|---|
| 2-1 | Giriş ekranı | E-posta kutusunda **zarf**, şifre kutusunda **kilit**, sağda **göz** | |
| 2-2 | Giriş → Google sekmesi | Google **"G"** logosu | |
| 2-3 | Kayıt Ol ekranı | **kişi**, **zarf**, **kilit** ×2, **göz** ×2 | |
| 2-4 | Ana ekran | Alt sekme çubuğundaki **tüm sekme ikonları**, sağ üstte **bildirim zili** | |
| 2-5 | Bir restoran detayı | **kalp** (favori), **yıldız** (puan), **telefon**, **konum**, **paylaş** | |
| 2-6 | Profil | Ayarlar satırlarındaki ikonlar | |
| 2-7 | **Her yerde** | Hiçbir yerde **soru işareti (?)** ikonu olmamalı | |

> Soru işareti görürsen o ikonun adı kırılmış demektir — hangi ekranda gördüğünü yaz.

### 3.2 Uygulama açılışı ve genel kararlılık

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 3-1 | Uygulamayı aç | Açılış ekranından sonra içerik gelir. **Beyaz/boş ekranda kalmamalı**, kapanmamalı | |
| 3-2 | Tüm alt sekmeleri tek tek aç | Hiçbiri **boş** render edilmemeli | |
| 3-3 | Uygulamayı arka plana al (ana ekran tuşu), 1 dakika bekle, geri dön | Kaldığın yerden devam etmeli | |
| 3-4 | Restoran listesini **hızlıca** aşağı yukarı kaydır | Takılma, boş kart, donma olmamalı | |

### 3.3 Modal'ların güvenli alanı (Faz 3'te değişti)

**Neden:** RN'in `SafeAreaView`'ı kullanımdan kalktı, iki modal başka bir
kütüphaneye taşındı. Yanlış olsaydı belirti: modal başlığı saatin altında kalır.

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 3-5 | Kayıt Ol ekranı → **"Gizlilik Politikası"** bağlantısına dokun | "Yasal Metinler" başlığı ve "Kapat" butonu **saat/pil simgelerinin altında**, rahat okunur | |
| 3-6 | Aynı modalda **"KVKK Aydınlatma"** sekmesine geç | İçerik değişir, **kaydırma en başa döner** | |
| 3-7 | Aşağı kaydır, sonra "Kapat" | İçerik taşmadan kayar, modal kapanır | |
| 3-8 | 🔴 Ana ekran → sağ üstteki **bildirim ziline** dokun | Panel açılır. **Üstten aşırı boşluk olmamalı**, alt kenarı telefonun gezinme çubuğunun altında kalmamalı | |
| 3-9 | Panelde "Tümünü Gör"e dokun | Bildirimler ekranına gider | |

### 3.4 Ana ekran animasyonu (Yeni Mimari'de davranışı değişebilir)

**Neden:** Animasyonu etkinleştiren API Yeni Mimari'de kaldırıldı. Çağrı korumalı
olduğu için **çökme riski yok**, ama animasyon kaybolmuş olabilir.

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 3-10 | Ana ekranda bir "ray"ı (yatay öneri şeridi) aç/kapa | Açılıp kapanmalı. Animasyon **yumuşak mı yoksa birden mi zıplıyor**, not al. İçerik doğru görünüyorsa animasyon sertse bu ⚠️, ❌ değil | |

### 3.5 🔴🔴 Harita — Yeni Mimari'nin en riskli noktası

**Neden en riskli:** `react-native-maps` eski tip bir bileşen; Yeni Mimari'de
"interop" denen uyumluluk katmanı üzerinden çalışıyor. Aynı katmana bağlı olan
Eatlas logosu gradyanının çalıştığı doğrulandı, **ama harita çok daha karmaşık**:
içinde Google Maps yüzeyi ve marker alt-bileşenleri var.

**Bozuksa belirtiler:** harita gri/boş kalır · pin'ler hiç çıkmaz · harita görünür
ama dokunma çalışmaz · pin'ler yanlış yerde durur · kaydırınca siyah alanlar açılır.

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 4-1 | Ana ekranda **harita görünümüne** geç (liste/harita değiştirici) | Harita **yüklenir**, sokaklar görünür. Gri/boş kalmamalı | |
| 4-2 | Haritada restoran **pin'lerine** bak | Pin'ler görünüyor ve doğru konumlarda | |
| 4-3 | Haritayı parmakla **kaydır** | Akıcı kayar, boş/siyah alan açılmaz | |
| 4-4 | İki parmakla **yakınlaştır/uzaklaştır** | Düzgün ölçeklenir, pin'ler birlikte hareket eder | |
| 4-5 | Yakınlaştırınca pin'lerin **kümelenmesi** (birleşip sayı göstermesi) | Kümeler açılıp kapanır | |
| 4-6 | Bir **pin'e dokun** | Alt tarafta önizleme kartı açılır, **doğru restoranı** gösterir | |
| 4-7 | Önizleme kartına dokun | Restoran detay ekranına gider | |

### 3.6 🔴 Ödeme / abonelik (paywall)

**Neden:** `expo-iap` 3 ana sürüm geride. Statik incelemede native yüzeyinin
mimariden bağımsız olduğu görüldü (yani muhtemelen sorun yok) — **ama bu çalışma
anı kanıtı değil.**

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 4-8 | Premium/abonelik ekranını aç (paywall) | Ekran açılır, **çökmez** | |
| 4-9 | Ürünler/fiyatlar listesine bak | Abonelik seçenekleri **fiyatlarıyla** listeleniyor mu? Boş liste / "yükleniyor"da takılma ❌ | |
| 4-10 | *(Play Console test hesabı hazırsa)* Satın alma akışını başlat | Google ödeme ekranı açılır | |

> 4-9 boş geliyorsa bu **beklenen olabilir**: Play Console'da ürün tanımları henüz
> tamamlanmadı. Bu durumda ⏭️ işaretle — Yeni Mimari hatası olmayabilir.
> Ekranın **açılıp açılmadığı** asıl ölçtüğümüz şey.

### 3.7 Diğer native özellikler

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 4-11 | Profil → profil fotoğrafı değiştir → galeriden bir fotoğraf seç | Galeri açılır, fotoğraf seçilir, kırpma/yükleme çalışır | |
| 4-12 | Konum izni ver → yakındaki restoranlar | Gerçek konumuna göre listeleniyor | |
| 4-13 | AI öneri akışını başlat ("Ne yesem?") | Yanıt **akarak** gelir (harf harf/parça parça), tek seferde değil | |
| 4-14 | Bir listede kaydırarak silme/işlem jesti varsa dene | Jest doğru tepki verir | |
| 4-15 | Bir form aç, klavyeyi aç | İçerik klavyenin altında kalmaz, yukarı kayar | |
| 4-16 | Bildirim gelmesini bekle / tetikle | Bildirim ulaşır, dokununca doğru ekrana götürür | |

### 3.8 🔴 Edge-to-edge — Faz 5 (SDK 55) ile ZORUNLU oldu

**Ne değişti:** SDK 55'te edge-to-edge kapatılamıyor (Android 16 gerekliliği).
Uygulama penceresi artık durum çubuğunun ve gezinme çubuğunun **altına kadar**
uzanıyor; sistem çubukları içeriği "itmiyor", üzerine biniyor.

**Bozuksa belirti:** başlık saatin altına girer · alttaki buton gezinme
çubuğunun arkasında kalır, tıklanamaz · liste son öğesi çubuğun altında kalır.

**Bu bir çökme değil, sessiz bir görsel bozulma** — otomatik test yakalayamaz.

Her ekranı tek tek gezmen gerekmiyor; **her navigasyon kabuğunun kenarlarına**
bakman yeterli (içerik ekranları aynı kabuğu paylaşıyor):

| # | Nereye bak | Beklenen | Durum |
|---|---|---|---|
| 5-1 | 5 sekmeli ana kabuk (Keşfet / Favoriler / Listeler / Mesajlar / Profil) — **alt sekme çubuğu** | Sekme ikonları ve yazıları gezinme çubuğunun **üstünde**, rahat tıklanıyor | |
| 5-2 | Aynı kabuk — **üst başlık** | Başlık ve bildirim zili saat/pil simgelerinin **altında** | |
| 5-3 | Stack ekranları (restoran detay, rezervasyon, sosyal) — **geri tuşu ve başlık** | Durum çubuğuyla çakışmıyor | |
| 5-4 | Restoran hesabı paneli ve alt ekranları | Üst/alt kenarlar temiz | |
| 5-5 | Admin paneli (yetkin varsa) | Üst/alt kenarlar temiz | |
| 5-6 | Onboarding / giriş / kayıt (tam ekran, sekme çubuğu yok) | "Eatlas" logosu durum çubuğunun altında; en alttaki bağlantı gezinme çubuğuyla çakışmıyor | |
| 5-7 | Harita ekranı (tam ekran, kendi kontrolleri var) | Harita kontrolleri ve alt önizleme kartı çubukların altında kalmıyor | |
| 5-8 | **Klavye açıkken** formlar (giriş, rezervasyon, mesaj yazma) | Yazdığın input ve gönder butonu klavyenin/çubuğun **altında kalmıyor** | |
| 5-9 | Uzun bir listeyi en alta kadar kaydır | **Son öğe tamamen görünüyor**, gezinme çubuğunun arkasında yarım kalmıyor | |

> Emülatörde giriş gerektirmeyen ekranlar (onboarding, giriş, kayıt, yasal
> metinler modalı) **doğrulandı** — logo ve alt bağlantılar doğru konumda.
> Yukarıdakilerden giriş gerektirenler senin turunda.

### 3.9 🔴 Sentry — kasıtlı crash ile stack trace doğrulaması

**Neden:** `@sentry/react-native` 6 → 7'ye çıktı. Kod yüzeyi tek dosya ve tip
denetimi temiz, **ama** #491'de kurulan source map zincirinin hâlâ çalıştığı
ancak gerçek bir crash ile kanıtlanabilir. Bozuksa fark etmenin tek yolu, ileride
gerçek bir crash geldiğinde stack trace'in okunamaz olması.

| # | Adımlar | Beklenen | Durum |
|---|---|---|---|
| 5-10 | Uygulamada kasıtlı bir crash üret (bunun için bana söyle, geçici bir "çökert" butonu ekleyeyim) | Uygulama kapanır | |
| 5-11 | Sentry panelinde (eatlas-pw / eatlas-mobile) olaya bak | Olay görünüyor | |
| 5-12 | Stack trace'i incele | **Dosya adları ve satır numaraları okunabilir** (`LoginScreen.tsx:42` gibi). `index.android.bundle:1:284917` gibi tek satırlık anlamsız çıktı ❌ | |

> 5-10 için hazır bir yol yok — bilerek eklemedim. Test etmeye hazır olduğunda
> söyle, geçici bir buton ekleyip APK üretirim.

---

## 4. Karar kuralı

Bir fark gördüğünde onu **bu dokümandaki bir madde numarasına bağla**.

> "Bir tuhaflık var ama tarif edemiyorum" bir sonuç değildir. Ya bir maddeye
> bağlanır ve karar verilir, ya da Yeni Mimari geri alınır. (#502 R4)

**Yeni Mimari'yi geri almak tek satır:** `app.json` → `expo.newArchEnabled: false`.
Bana söylemen yeterli. ⚠️ **Ama bu imkân Faz 5 (SDK 55) merge edilince kalkıyor** —
o sürüm flag'i tamamen kaldırıyor.

---

## 5. Bir şey kırıksa: hangi faz bozdu?

Faz 4 APK'sında bir sorun bulursan, sorunun hangi fazdan geldiğini **ikiye bölerek**
bulabilirsin. Toplam 4 APK var, yani en fazla 2 kurulumda cevabı bulursun.

**Adım 1 — ortadan başla.** SDK 53 APK'sını kur ve **sadece kırık olan testi** tekrarla:

```bash
adb install -r ~/eatlas-upgrade-archive/eatlas-faz2-sdk53.apk
```

- **Sorun burada da varsa** → Faz 1 veya Faz 2'den geliyor. Adım 2A'ya git.
- **Sorun burada YOKSA** → Faz 3 veya Faz 4'ten geliyor. Adım 2B'ye git.

**Adım 2A — yükseltme öncesine in:**

```bash
adb install -r ~/eatlas-upgrade-archive/eatlas-sdk52-pre-faz1-v2.0.14-vc42.apk
```

- Sorun burada da varsa → **yükseltmeyle ilgisi yok**, önceden beri var olan bir hata.
- Yoksa → Faz 1 (kütüphane ana sürümleri) bozmuş.

**Adım 2B — SDK 54'ü dene:**

```bash
adb install -r ~/eatlas-upgrade-archive/eatlas-faz3-sdk54.apk
```

- Sorun burada da varsa → **Faz 3** (SDK 54) bozmuş.
- Yoksa → **Faz 4** (Yeni Mimari) bozmuş. Bu en iyi senaryo: tek satırla geri alınır.

Sonucu bana şu formatta söylemen yeterli:
**"4-1 harita gri kalıyor; faz3 APK'sında çalışıyor, faz4'te çalışmıyor."**

---

## 6. Test edilemeyen / kapsam dışı

Bunlar bu turda **beklenmiyor**, boşuna arama:

| Konu | Neden |
|---|---|
| Play Store'dan indirme | Arşiv APK'ları debug anahtarıyla imzalı, Store'a yüklenemez |
| Gerçek satın alma | Play Console ürün tanımları henüz tamamlanmadı |
| iOS | Bu yükseltme zincirinde yalnızca Android build'i doğrulanıyor |
| x86 tablet / Chromebook | APK yalnızca ARM cihazları destekliyor (bu yükseltmeden önce de böyleydi) |
