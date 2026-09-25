# Expo SDK Yükseltmesi — Toplu Manuel Test Listesi

> EPIC #497 · Fazlar tek tek merge edilirken **test edilmedi**; hepsi burada toplandı.
> Bu doküman, her fazın **tam olarak neyi değiştirdiğini** ve dolayısıyla **neye
> bakman gerektiğini** söyler. Tam tur için ayrıca `UPGRADE_SMOKE_TEST.md`'deki
> A–J listesi var — burada onu tekrar etmiyoruz, **sadece faz deltalarını** veriyoruz.

## Nasıl test edilir

Her faz için ayrı bir APK arşivlendi (`~/eatlas-upgrade-archive/`). Bir sorun
çıkarsa hangi fazdan geldiğini **ikiye bölerek** bulabilirsin: önce ortadaki fazın
APK'sını kur, sorun varsa daha eski fazlara in, yoksa daha yenilere çık.

```bash
export PATH="$PATH:/opt/homebrew/share/android-commandlinetools/platform-tools"
adb install -r ~/eatlas-upgrade-archive/<faz>.apk
adb shell am start -n com.eatlas.mobile/.MainActivity
```

> ⚠️ Fazlar arasında geri giderken (`yeni → eski`) imza/sürüm düşüşü yüzünden
> `adb install -r` reddedebilir. O durumda `adb uninstall com.eatlas.mobile`
> gerekir — **uygulama verisi silinir**, yani oturumu yeniden açman gerekir.

### Durum kodları

`✅ geçti` · `❌ kırık` · `⚠️ şüpheli/garip` · `⏭️ test edilemedi (neden)`

---

## 🔴 Öncelik sırası

Zamanın kısıtlıysa şu sırayla git — en yüksek iş riski en üstte:

1. **Google ile giriş + oturum koruma** (Faz 1a'da kütüphane sözleşmesi değişti)
2. **İkonlar** (Faz 2'de tamamen kaybolmuştu; her ekranda kontrol et)
3. **Navigasyon geri tuşu davranışı** (Faz 1b'de `navigate` → `popTo`)
4. **Modal'ların güvenli alanı** (Faz 3'te SafeAreaView değişti)
5. Geri kalan A–J smoke-test turu

---

## Faz 1a — Google Sign-In v13 → v16 (PR #508, merged)

**Ne değişti:** Kütüphane sözleşmesi değişti — `signIn()` ve `signInSilently()`
artık kullanıcı iptal ettiğinde / kayıtlı hesap yokken **hata fırlatmıyor**,
`{ type: 'cancelled' }` / `{ type: 'noSavedCredentialFound' }` döndürüyor. Kod bu
duruma göre yeniden yazıldı.

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 1a-1 | Google ile giriş yap | Hesap seçici açılır, giriş başarılı | |
| 1a-2 | Google hesap seçicide **iptal** et (geri tuşu) | Uygulama giriş ekranında kalır, "iptal edildi" mesajı; **çökmemeli, donmamalı** | |
| 1a-3 | Giriş yap → uygulamayı RAM'den tamamen kapat → tekrar aç | **Oturum açık gelmeli** (yeniden giriş istememeli) | |
| 1a-4 | Çıkış yap → uygulamayı kapat → tekrar aç | Giriş ekranı gelmeli; oturum **yanlışlıkla geri yüklenmemeli** | |

> ⚠️ 1a-4 bu göçün en tehlikeli noktasıydı: v16'da "kayıtlı hesap yok" artık hata
> değil, sonuç objesi. Açık kontrol olmasaydı oturum yanlışlıkla açık sayılırdı.

---

## Faz 1b — React Navigation 6 → 7 (PR #510, merged)

**Ne değişti:** v7'de `navigate()` artık yığındaki mevcut bir ekrana **geri
dönmüyor**, üstüne kopya itiyor. İki yerde `popTo()` ile değiştirildi.

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 1b-1 | Rezervasyonlarım → bir rezervasyonu **düzenle** → kaydet | "Rezervasyonlarım" listesine döner; **geri tuşu düzenleme ekranına dönmemeli** | |
| 1b-2 | Şifremi unuttum → e-postadaki bağlantı → yeni şifre belirle → "Giriş Yap" | Giriş ekranına döner; geri tuşu **kullanılmış sıfırlama ekranına dönmemeli** | |
| 1b-3 | Sekmeler arasında birkaç tur gezin, geri tuşuna arka arkaya bas | Yığın mantıklı ilerlemeli, aynı ekran üst üste yığılmamalı | |

---

## Faz 1c — AsyncStorage 1 → 2 (PR #511)

**Ne değişti:** Depolama kütüphanesi ana sürüm atladı.

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 1c-1 | **Eski sürümü kurulu bir cihaza** bu APK'yı üstüne kur (uninstall etme) | Önceki verilerin korunmalı: onboarding tekrar çıkmamalı, tercihler durmalı | |
| 1c-2 | Tema/tercih değiştir → uygulamayı kapat → aç | Ayar korunmuş olmalı | |

---

## Faz 1d — react-native-safe-area-context 4 → 5 (PR #512)

**Ne değişti:** Güvenli alan kütüphanesi ana sürüm atladı. Çentikli/kavisli
ekranlarda ve gezinme çubuğu olan cihazlarda etkili.

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 1d-1 | Tüm ana sekmeleri gez | İçerik **çentiğin/durum çubuğunun altında kalmamalı** | |
| 1d-2 | Alt gezinme çubuğu olan ekranlar | Butonlar sistem çubuğunun **altında kalmamalı**, tıklanabilir olmalı | |
| 1d-3 | Cihazı yatay çevir (destekleniyorsa) | Kenar boşlukları doğru güncellenmeli | |

---

## Faz 2 — Expo SDK 52 → 53 (PR #513)

**Ne değişti:** React 18 → 19, RN 0.76 → 0.79. Ayrıca **ikonların tamamen
kaybolduğu** bir regresyon çıktı ve düzeltildi (`expo-file-system` bağımlılık
ağacından düşmüştü).

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 2-1 | 🔴 **Her ekranda ikonlara bak** | Hiçbir ikon **boş/görünmez** olmamalı. Özellikle: giriş ekranı (zarf, kilit, göz), Google "G", sekme çubuğu, bildirim zili, yıldız/kalp | |
| 2-2 | Soru işareti (`?`) ikonu görünen yer var mı | Olmamalı — varsa o ikon adı kırılmış demektir | |
| 2-3 | Uygulamayı aç-kapa, sekmeler arası gez | Çökme olmamalı (React 19 render değişiklikleri) | |
| 2-4 | Listeler (restoran listesi, yorumlar) hızlıca kaydır | Takılma/boş kalma olmamalı | |

---

## Faz 3 — Expo SDK 53 → 54 (PR: bu faz)

**Ne değişti:** RN 0.79 → 0.81, React 19.1. RN'in kullanımdan kaldırılan
`SafeAreaView`'ı **2 modal bileşeninde** `react-native-safe-area-context`'e taşındı.
Edge-to-edge kasıtlı olarak **kapalı** tutuldu (görsel değişiklik istemiyoruz).

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 3-1 | 🔴 **Bildirim zili**ne bas, panel açılsın | Panel başlık çubuğunun altında açılmalı; **üstten aşırı boşluk olmamalı**, alt kenarı gezinme çubuğunun altında kalmamalı | |
| 3-2 | 🔴 **Gizlilik Politikası / KVKK** modalını aç | Başlık ve "Kapat" butonu durum çubuğunun **altında kalmamalı**; sekmeler ve metin okunabilir olmalı | |
| 3-3 | Aynı modalda sekme değiştir (Gizlilik ↔ KVKK) ve kaydır | Kaydırma başa dönmeli, içerik taşmamalı | |
| 3-4 | Uygulama genelinde durum çubuğu/gezinme çubuğu | Faz 2'ye göre **değişmemiş** görünmeli (edge-to-edge kapalı tutuldu) | |
| 3-5 | Animasyonlu geçişler (ekran geçişleri, basma efektleri) | Akıcı olmalı — Reanimated 3.19'a yükseltildi | |

---

## Faz 4 — Yeni Mimari (New Architecture) 🔴 en riskli faz

**Ne değişti:** Tek satır — `newArchEnabled=false` → `true`. Ama bu satır RN'in
köprü mimarisini tamamen değiştiriyor (Fabric renderer + TurboModules +
Bridgeless). **Hiçbir paket sürümü değişmedi.** Her native modül, her özel view
bundan etkilenebilir.

> **Geri dönüş:** Bu fazda bir sorun görürsen tek satırla dönülür —
> `app.json` → `expo.newArchEnabled: false`. Faz 5'e geçilirse bu kapı kapanıyor.
> Bu yüzden **bu listedeki maddeler Faz 5 başlamadan önce bitmeli.**

### 🔴 Şüpheli native modüller (bu fazın asıl işi)

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 4-1 | **Eatlas logosu** — her ekranın header'ında, giriş/kayıt ekranlarında | Turuncu→sarı **gradyan** doğru görünmeli. Düz renk / siyah kutu / kayıp = `masked-view` Fabric'te bozuldu | |
| 4-2 | **Harita ekranı** — restoran haritası | Harita yükleniyor, **pin'ler görünüyor**, kümeleme çalışıyor | |
| 4-3 | Haritada bir pin'e dokun | Alt önizleme kartı açılıyor, doğru restoranı gösteriyor | |
| 4-4 | Haritayı kaydır/yakınlaştır | Akıcı, boş/gri alan kalmıyor | |
| 4-5 | **Ödeme / abonelik ekranı** (paywall) aç | Ürünler listeleniyor mu? `expo-iap` 3 major geride, **en şüpheli modül**. Çalışmazsa Faz 7 öne alınacak — bu bir karar, kırık bırakma değil | |

### Genel regresyon (Fabric her şeyi etkileyebilir)

| # | Test | Beklenen | Durum |
|---|---|---|---|
| 4-6 | Uygulamayı aç | Açılışta **çökme yok**, beyaz/boş ekran yok | |
| 4-7 | Tüm sekmeleri tek tek gez | Hiçbir ekran boş render edilmiyor | |
| 4-8 | **Ana ekranda rayları aç/kapa** | Animasyon çalışıyor. ⚠️ `UIManager.setLayoutAnimationEnabledExperimental` Yeni Mimari'de kaldırıldı; çağrı korumalı (çökmez) ama **animasyon davranışı değişebilir** | |
| 4-9 | Uzun listeleri hızlı kaydır (restoranlar, yorumlar) | Akıcılık Faz 3'e göre **kötüleşmemeli** | |
| 4-10 | Bir fotoğraf yükle (profil / restoran) | `expo-image-picker` + `expo-image-manipulator` çalışıyor | |
| 4-11 | Bildirim al / bildirim zili | Bildirimler geliyor, panel açılıyor | |
| 4-12 | AI öneri akışı (streaming) | Yanıt **akarak** geliyor, tek seferde değil | |
| 4-13 | Google ile giriş + çıkış + tekrar giriş | Çalışıyor (TurboModule'e geçti) | |
| 4-14 | Dokunma/kaydırma jestleri (kaydırarak silme vb.) | `gesture-handler` doğru tepki veriyor | |
| 4-15 | Klavye açılınca form kayması | İçerik klavyenin altında kalmıyor | |

> **Karar kuralı (#502 R4):** Bir fark gördüğünde onu **bu listedeki bir maddeye
> bağla**. "Bir tuhaf ama tarif edemiyorum" kabul edilmiyor — ya maddeye bağlanır
> ve karar verilir, ya da flag geri alınır.

---

## Sonraki fazlar

Faz 5–6 (SDK 55–57) ve Faz 7 (expo-iap) tamamlandıkça bu dokümana kendi
bölümlerini ekleyecek.
