# Expo SDK Yükseltmesi — Baseline Ölçümleri

> EPIC #497 · Faz 0 (#498) çıktısı
> **Amaç:** Yükseltme zincirinin her fazında "bir şey kötüleşti mi?" sorusuna
> sayıyla cevap verebilmek. Bu dosya her fazda **yeni bir sütunla genişletilir**,
> eski değerler silinmez.

## Ölçüm koşulları

Sonraki fazlarda karşılaştırmanın anlamlı olması için ölçümler **aynı koşullarda** tekrarlanmalı:

| | Değer |
|---|---|
| Ölçüm tarihi | 2026-09-21 |
| Makine | macOS (Apple Silicon) |
| Node | 22.x |
| JDK | OpenJDK 21.0.12 (`/opt/homebrew/opt/openjdk@21/...`) |
| Android SDK | `/opt/homebrew/share/android-commandlinetools`, platform 35, build-tools 35.0.0 |
| Test cihazı | `emulator-5554` · `sdk_gphone64_arm64` · **Android 14** |
| Kurulum yöntemi | `npm ci` (CI ile aynı, `npm install` DEĞİL) |
| Build yolu | ⚠️ ASCII yol (aşağıdaki B1 bulgusuna bakın) |

---

## Baseline tablosu — SDK 52 (`expo@52.0.49`, RN 0.76.9, React 18.3.1)

| Ölçüm | SDK 52 (Faz 0) | Nasıl ölçülür |
|---|---|---|
| **Test sayısı** | **577** (65 suite) | `npm test` |
| Jest süresi (kapsamsız) | 2,6 sn | `npm test` |
| Jest süresi (kapsamlı) | 5,7 sn | `npx jest --coverage` |
| **Kod tabanı satır kapsamı (tüm `src/`)** | **%22,34** (1036/4636) | `npx jest --coverage --collectCoverageFrom='src/**/*.{ts,tsx}'` |
| ├─ `services/` | %78,74 (537/682) | (#430'da yükseltildi) |
| ├─ `utils/` | %82,87 (150/181) | |
| ├─ `store/` | %67,43 (176/261) | |
| ├─ `components/` | %17,24 (75/435) | |
| ├─ `screens/` | **%2,31** (68/2944) | ⚠️ aşağıya bakın |
| └─ `navigation/` | %1,37 (1/73) | |
| Dal (branch) kapsamı | %14,00 (539/3849) | |
| **ESLint** | **0 hata** / 263 uyarı | `npm run lint` |
| **`tsc --noEmit`** | **temiz** | `npm run typecheck` |
| **`npm audit`** | **1 kritik / 11 yüksek / 21 orta** (33) | `npm audit --json` |
| Toplam bağımlılık | 1239 | `npm audit --json` → `metadata.dependencies.total` |
| `node_modules` boyutu | 503 MB (696 üst düzey paket) | `du -sh node_modules` |
| **Release APK** | **37,8 MB** | `./gradlew assembleRelease` |
| **Release AAB** | **38,5 MB** | `./gradlew bundleRelease` |
| JS bundle | 3,5 MB | `android/app/build/generated/assets/.../index.android.bundle` |
| **Soğuk başlangıç (medyan)** | **358 ms** | `adb shell am start -W` → `TotalTime`, 5 ölçüm |
| └─ ham ölçümler | 314 / 350 / 358 / 366 / 426 ms | |

### ⚠️ `screens/` kapsamı %2,31 — bu neden önemli?

2944 satırlık ekran kodunu **hiçbir otomatik test korumuyor**. Bu bilinçli bir tercih
(CLAUDE.md: *"ağır ekranları mount etmek yerine saf mantığı `utils/`'e çıkar"*), ama
yükseltme bağlamında şu anlama geliyor:

> **Bir SDK yükseltmesinin en çok bozduğu yer (render, layout, native bileşen davranışı)
> tam olarak test kapsamının en düşük olduğu yer.** `npm test` yeşil olması, ekranların
> çalıştığına dair **hiçbir kanıt sunmuyor**.

Manuel smoke-test listesinin (`UPGRADE_SMOKE_TEST.md`) zorunlu olmasının sebebi budur.

---

## 🔴 Faz 0'da ortaya çıkan bulgular

Bunlar yükseltmeden **bağımsız**, şu an var olan durumlar. Sonraki fazlarda
"yükseltme bozdu" diye yanlış atfedilmemeleri için burada kayıt altına alınıyor.

### B1 — 🔴 Release build Türkçe karakterli yoldan ÜRETİLEMİYOR

Depo `…/Desktop/Deniz Kişisel/Eatlas/…` altında. Bu yoldan `./gradlew assembleRelease`
çalıştırıldığında JS paketleme adımı **başarısız oluyor**:

```
Task :app:createBundleReleaseJsAndAssets FAILED
Error: Unable to resolve module .../node_modules/expo/AppEntry.js from .../neareat-mobile/.
```

Dosya **fiziksel olarak mevcut** — sorun Metro'nun yoldaki `ş` karakterini çözümleyememesi.

**Ölçülerek doğrulandı:** Aynı commit, aynı `node_modules`, ASCII bir yoldan
(`/private/tmp/.../pr-wt/neareat-mobile`) çalıştırıldığında **BUILD SUCCESSFUL**.

> ⚠️ **Bu, daha önceki "release build Türkçe yoldan etkilenmez" varsayımını düzeltir.**
> O varsayım yalnızca Metro dev-sunucusunun `/status` ucu için geçerliydi; release
> **paketleme** adımı da etkileniyor, farklı bir belirtiyle.

**Etkisi:** Her fazda üretilecek doğrulama APK'ları ve geri dönüş için arşivlenecek
ikililer ASCII bir yoldan build edilmeli. **Kalıcı çözüm:** depoyu Türkçe karakter
içermeyen bir dizine taşımak.

### B2 — 🟡 `@sentry/cli` postinstall betiği çalışmıyor

`npm ci` çıktısı:
```
npm warn install-scripts 2 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @sentry/cli@2.42.4 (postinstall: node ./scripts/install.js)
```
npm'in `allowScripts` politikası nedeniyle Sentry CLI ikilisi indirilmiyor olabilir.
Bu, #491'de kurulan **source map upload** zincirini etkileyebilir.
→ Faz 5 (Sentry 6→7) ve Faz 8'de "gerçek release'de okunabilir stack trace" kriteriyle doğrulanacak.

### B3 — 🟡 Sentry upload adımı `SENTRY_AUTH_TOKEN` olmadan build'i KIRIYOR

Token tanımlı olmayan bir kabuktan release build alındığında:
```
Task ':app:...SentryUpload...' FAILED
Process 'command '.../@sentry/cli/bin/sentry-cli'' finished with non-zero exit value 1
```
Yani eksik token **sessizce atlanmıyor, build'i başarısız kılıyor**.

**Geçici çözüm (doğrulama build'leri için):** `SENTRY_DISABLE_AUTO_UPLOAD=true` ile build al.
Baseline APK/AAB bu bayrakla üretildi.

### B4 — 🟡 Yerel `node_modules` `package.json` ile senkron değildi

Ölçüme başlarken `@eslint/js` kurulu değildi ve `npx eslint` global 10.x sürümüne
düşüyordu (`package.json` `^9.39.5` istiyor). `npm ci` ile giderildi.
→ **Kural:** her fazın ölçümleri `npm ci` sonrası alınmalı (CI ile aynı durum).

### B5 — ℹ️ Baseline APK debug anahtarıyla imzalı

Upload keystore şifresi kayıp (Play Console'da sıfırlama talebi sürüyor), bu yüzden
`build.gradle`'ın kasıtlı fallback'i devreye girdi ve APK **debug anahtarıyla**
imzalandı. Boyut/performans ölçümü için sorun değil; **Play Store'a yüklenemez**.
→ Yeni upload key onaylandığında arşiv yenilenmeli.

---

## Arşivlenen ikililer (geri dönüş için)

| Dosya | Konum | Not |
|---|---|---|
| `eatlas-sdk52-pre-faz1-v2.0.14-vc42.apk` | `~/eatlas-upgrade-archive/` | 37,8 MB, debug imzalı, emülatöre kurulup açıldığı doğrulandı (365 ms, crash yok) |
| `eatlas-sdk52-pre-faz1-v2.0.14-vc42.aab` | `~/eatlas-upgrade-archive/` | 38,5 MB, debug imzalı |

**Git etiketi:** `mobile-pre-faz1` → commit **`4ac5e1d`** (`Merge pull request #496`)

> İkililer bu commit'ten üretildi — yani `#494` (expo-iap native bağımlılıkları:
> `billing-ktx`, `play-services-base`) **dahil**. Arşiv ile etiket birebir eşleşir;
> geri dönüşte `git checkout mobile-pre-faz1` ile aynı ikili yeniden üretilebilir
> (ASCII yoldan, bkz. B1).

> ⚠️ Arşiv dizini repo dışında ve `.gitignore` zaten `*.apk`/`*.aab` içeriyor.
> Bu dizin **yedeklenmeli** (harici disk / bulut) — kaybolursa geri dönüş yolu zayıflar.

---

## Faz karşılaştırma tablosu

> **Birim notu:** APK boyutları **MiB** (1024²). Faz 0'ın "37,8 MB"ı da MiB'dir
> (39.610.903 bayt) — ondalık MB ile karıştırma.
>
> `—` = o fazda ölçülmedi (sonradan uydurulmadı).

| Ölçüm | Faz 0 (SDK 52) | Faz 2 (SDK 53) | Faz 3 (SDK 54) | Faz 4 (New Arch) | Faz 5 (SDK 55) | Faz 6 (SDK 57) |
|---|---|---|---|---|---|---|
| Test sayısı | 577 (65 suite) | 600 (66) | 605 (66) | **605 (66)** | | |
| Kod tabanı satır kapsamı | %22,34 | — | %22,39 | değişmedi | | |
| `services/` satır kapsamı | %78,74 | — | %78,83 | değişmedi | | |
| ESLint hata / uyarı | 0 / 263 | 0 / 263 | 0 / 263 | **0 / 263** | | |
| `tsc --noEmit` | temiz | temiz | temiz | **temiz** | | |
| `npm audit` (K/Y/O) | 1/11/21 | — | 0/9/10 | değişmedi | | |
| APK boyutu | 37,8 MiB | 37,6 MiB | 37,8 MiB | **28,6 MiB** ⬇ | | |
| Soğuk başlangıç (medyan) | 358 ms | — | 368 ms | **325 ms** ⬇ | | |
| `node_modules` | 503 MB (696 paket) | — | 510 MB (583 paket) | değişmedi | | |

Faz 3 soğuk başlangıç ham ölçümleri: 320 / 323 / **368** / 395 / 409 ms.
Faz 4 soğuk başlangıç ham ölçümleri: 294 / 303 / **325** / 369 / 377 ms.

> Faz 4'te paket sürümü **değişmedi** (tek satır flag), o yüzden kapsam/audit/
> node_modules ölçümleri Faz 3 ile aynı — tekrar ölçülmedi.

---

## Faz 3 (SDK 54) — ölçüm sırasında çıkanlar

Sürüm yükseltmesinin kendisi dışında build'i kıran/kırabilecek üç şey çıktı:

1. **Gradle wrapper 8.10.2 → 8.14.3 gerekti.** RN 0.81 minimum 8.13 istiyor
   (`Minimum supported Gradle version is 8.13`). `expo prebuild` mevcut `android/`
   dizinini koruduğu için wrapper'ı kendiliğinden güncellemiyor — elle yapıldı.
   Seçilen sürüm RN 0.81'in kendi şablonundaki sürüm (8.14.3), hata mesajındaki
   minimum değil.

2. **`babel-preset-expo` kök bağlamdan çözülemedi.** SDK 54'te
   `expo/node_modules/` altına yuvalandı; `babel.config.js` onu kökten çözmek
   zorunda olduğu için **tüm Jest paketi** `Cannot find module 'babel-preset-expo'`
   ile çöktü. Açık `devDependency` yapıldı. (Faz 2'deki `expo-file-system`
   vakasıyla aynı sınıf — bkz. `dependencyIntegrity.test.ts`.)

3. **`expo-modules-core` CMake yapılandırması bir kez patladı.** Sebep kalıcı bir
   uyumsuzluk değildi: önceki build yarıda kesildiği için `.cxx` durumu bozuk
   kalmıştı. Aynı CMake komutu elle çalıştırıldığında sorunsuz yapılandırdı.
   Çözüm: `rm -rf node_modules/expo-modules-core/android/.cxx`.
   **Genel kural: gradle build'i yarıda kesersen `.cxx` dizinini temizle.**

### Kasıtlı sapmalar

| Ne | Karar | Neden |
|---|---|---|
| `react-native-reanimated` | **3.19.5**'te tutuldu (`expo install --check` 4.1.1 öneriyor) | Reanimated 4 **yalnızca Yeni Mimari**'yi destekliyor (paketin kendi README'si: *"If your app still runs on the old architecture… stay with latest 3.x release"*). Bu faz Legacy'de kalmak zorunda → Faz 4'ün işi. |
| Edge-to-edge | **Kapalı** (`app.json` → `android.edgeToEdgeEnabled: false`) | SDK 54 prebuild'i kendiliğinden açıyor ve uygulama sistem çubuklarının altına çiziyor. Bu fazın amacı Yeni Mimari öncesi **bilinen-iyi bir geri dönüş noktası** kurmak; bağımsız bir görsel değişiklik etki alanını gereksiz genişletirdi. SDK 55+'ta zorunlu hâle geliyor, orada ele alınacak. |

---

## Faz 4 (Yeni Mimari) — ölçüm sırasında çıkanlar

### 🔴 NDK 26 → 27 zorunluydu

Flag açılınca derleme şuradan patladı:

```
graphicsConversions.h:80: error: no member named 'format' in namespace 'std'
    return std::format("{}%", dimension.value);
```

RN 0.81'in C++ başlıkları `std::format` (C++20 kütüphane özelliği) kullanıyor;
**NDK 26'nın libc++'ında bu yok**, NDK 27 (clang 18 / LLVM 18) ile geldi.

**Neden daha önce çıkmadı:** codegen'in ürettiği C++ dosyaları yalnızca Fabric
açıkken derleniyor. Legacy build'lerde bu başlıklara hiç dokunulmuyordu, bu yüzden
`ndkVersion = "26.1.10909125"` eski bir commit'ten beri (v11 dönemi) SDK 52→54
boyunca fark edilmeden duruyordu — `expo prebuild` bu değeri koruyor.

**Çözüm:** NDK 27.1.12297006 kuruldu ve sürüm `withAndroidBuildFixes` config
plugin'ine bağlandı (`withRequiredNdkVersion`), böylece her prebuild'de kalıcı.

### APK 37,8 → 28,6 MiB: ölü x86 dilimi düştü

Yeni Mimari APK'sı 9,2 MiB küçüldü. Sebep ABI kapsamı:

| | Faz 3 (Legacy) | Faz 4 (New Arch) |
|---|---|---|
| Paketlenen ABI | arm64-v8a, armeabi-v7a, x86, x86_64 | arm64-v8a, armeabi-v7a |

**Bu bir kayıp değil — Faz 3'ün x86 dilimi zaten çalışmıyordu.** Ölçüldü: Faz 3
APK'sında x86 için `libexpo-modules-core.so`, `libreanimated.so`,
`librnscreens.so`, `libworklets.so` **yoktu**; yalnızca AAR'lardan gelen hazır
kütüphaneler (hermes, reactnative, sentry, fresco) paketlenmişti. Çünkü
`reactNativeArchitectures=arm64-v8a,armeabi-v7a` **zaten öyleydi** (bu fazda
değişmedi) ve kaynaktan derlenen modüller x86 için hiç üretilmiyordu. Yani x86
bir cihaz o APK'da nasılsa çökerdi. Yeni Mimari build'i bu ölü ağırlığı
paketlemeyi bıraktı.

> x86_64 desteği gerekirse (Chromebook, Intel emülatör) `reactNativeArchitectures`
> genişletilmeli — bu, Yeni Mimari'nin getirdiği bir kısıt değil, projenin
> önceden beri süren bir tercihi.

### Doğrulananlar

- Bridgeless mode **aktif** (logcat: `BridgelessReact`, `libfabricjni_so`)
- Uygulama açılıyor, çökme yok
- **`masked-view` Fabric'te çalışıyor** — Eatlas logosunun turuncu→sarı gradyanı
  doğru render ediliyor (#502 R3 gerçekleşmedi)
- Tüm `@expo/vector-icons` ikonları render ediliyor
- Soğuk başlangıç **iyileşti**: 368 ms → 325 ms

### ⏭️ Emülatörde doğrulanamayanlar (giriş yapılmış hesap gerekiyor)

`react-native-maps` (Fabric render), `expo-iap` (paywall), bildirim zili,
AI streaming, fotoğraf yükleme. Hepsi `UPGRADE_MANUAL_TESTS.md` → Faz 4'te.
**#502'nin kabul kriterleri bu testler yapılmadan karşılanmış sayılmaz.**
