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
| Test sayısı | 577 (65 suite) | 600 (66) | 605 (66) | 605 (66) | 607 (66) | **607 (66)** |
| Kod tabanı satır kapsamı | %22,34 | — | %22,39 | değişmedi | — | — |
| `services/` satır kapsamı | %78,74 | — | %78,83 | değişmedi | — | — |
| ESLint hata / uyarı | 0 / 263 | 0 / 263 | 0 / 263 | 0 / 263 | 0 / 263 | **0 / 263** |
| `tsc --noEmit` | temiz | temiz | temiz | temiz | temiz | **temiz** |
| `npm audit` (K/Y/O) | 1/11/21 | — | 0/9/10 | değişmedi | 0/0/13 ⬇ | **0/0/13** 🎯 |
| APK boyutu | 37,8 MiB | 37,6 MiB | 37,8 MiB | 28,6 MiB ⬇ | 31,6 MiB | **34,4 MiB** |
| Soğuk başlangıç (medyan) | 358 ms | — | 368 ms | 325 ms ⬇ | 351 ms | **394 ms** |
| `node_modules` | 503 MB (696 paket) | — | 510 MB (583 paket) | değişmedi | — | — |

Faz 3 soğuk başlangıç ham ölçümleri: 320 / 323 / **368** / 395 / 409 ms.
Faz 4 soğuk başlangıç ham ölçümleri: 294 / 303 / **325** / 369 / 377 ms.
Faz 5 soğuk başlangıç ham ölçümleri: 300 / 301 / **351** / 356 / 373 ms.
Faz 6 soğuk başlangıç ham ölçümleri: 357 / 366 / **394** / 395 / 426 ms.

> Faz 6'nın 394 ms'i baseline'ın 358 ms'inden yüksek ama **ham aralıklar
> örtüşüyor** (baseline 314–426, Faz 6 357–426) — net bir regresyon değil.
> ⚠️ İlk ölçümde 604 ms çıkmıştı; o sırada arka planda derleme vardı.
> **Ölçümler boş makinede alınmalı.**

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

3. **`expo-modules-core` CMake yapılandırması bir kez patladı.**
   `rm -rf node_modules/expo-modules-core/android/.cxx` ile geçti.

   > ⚠️ **DÜZELTME (Faz 5'te anlaşıldı): buradaki teşhis YANLIŞTI.**
   > O sırada sebebi "önceki build yarıda kesildiği için `.cxx` bozuldu" diye
   > yazmıştım. Gerçek sebep neredeyse kesinlikle **`/tmp` symlink'i** — aşağıdaki
   > B6 bulgusuna bakın. `.cxx` silmek işe yaradı çünkü yolları yeniden
   > çözdürüyordu, kök nedeni gidermiyordu. "Yarıda kesilen build" kuralı
   > geçersizdir; doğru kural **build'i `/tmp` altında almamak**.

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

---

## Faz 5 (SDK 55) — ölçüm sırasında çıkanlar

### 🔴 B6 — Build `/tmp` altından alınamaz (macOS symlink'i CMake'i bozuyor)

Bu, B1'in (Türkçe karakter) yanına eklenen **ikinci yol kuralı**.

SDK 55 build'i şurada kırıldı:
```
ninja: error: '.../react-native-worklets/android/build/intermediates/cmake/release/
obj/arm64-v8a/libworklets.so', needed by 'libexpo-modules-core.so',
missing and no known rule to make it
```

**Kök neden bizim kodumuzda değil:** bilinen bir Expo SDK 55 hatası
(expo/expo#42893, #42892). macOS'ta CMake ve Ninja, **symlink üzerinden çözülen
yollarda mantıksal ve fiziksel yolu karıştırıyor**; Ninja `.so` dosyasını
gerçekte üretildiği yerden farklı bir yolda arıyor.

Build worktree'si `/tmp/eatlas-build-wt` altındaydı ve macOS'ta
**`/tmp` → `private/tmp`** bir symlink'tir. Belirti loglarda baştan beri
görünüyordu: aynı derleme komutunda `-H/private/tmp/...` ile `-I/tmp/...` yan yana.

**Çözüm:** worktree `~/eatlas-build-wt`'ye taşındı (symlink yok, ASCII).
Daha önce kırılan `expo-modules-core:buildCMakeRelWithDebInfo` görevi geçti.

> **Kural: build yolu hem ASCII olmalı (B1) hem de `/tmp` altında olmamalı (B6).**
> `git worktree move <eski> <yeni>` ile taşınabilir; sonra proje Gradle
> önbelleklerini temizlemek gerekiyor (`android/.gradle`, `android/build`,
> modüllerin `android/build` ve `.cxx` dizinleri) — yoksa eski mutlak yollar
> önbellekte kalıyor.

### ⚠️ `expo prebuild --clean` üç ayarı sessizce sıfırlıyor

`android/` dizini SDK ≤54 şeklinde bayatladığı için (aşağıya bakın) `--clean`
ile yeniden üretildi. Bu, şablon varsayılanlarına dönüşe yol açtı — hepsi
ölçülerek yakalandı ve `withAndroidBuildFixes` plugin'ine sabitlendi:

| Ayar | `--clean` sonrası | Ölçülen etki |
|---|---|---|
| `reactNativeArchitectures` | 2 ABI → **4 ABI** | Build süresi ~2 katı; x86 dilimi Faz 4'te zaten ölü diye ölçülmüştü |
| `expo.useLegacyPackaging` | `true` → **`false`** | Native kütüphaneler sıkıştırılmıyor: `libreactnative.so` 6,0 MiB ham → arşivde de 6,0 MiB (normalde 1,8 MiB). APK 31,6 → **52,5 MiB** |
| `edgeToEdgeEnabled` | kaldırıldı | Beklenen — SDK 55'te zorunlu |

> `expo.useLegacyPackaging=true`'ya geri dönüldü çünkü bu fazın paketleme
> davranışını sessizce değiştirmemesi gerekiyordu. **Ama Google modern
> paketlemeyi (`false`) öneriyor** — kütüphaneler doğrudan APK'dan yükleniyor,
> kurulum sonrası disk ve RAM kazancı var, Play Store AAB'de zaten yeniden
> optimize ediliyor. Ayrı bir kararla gözden geçirilmeli.

### `android/` dizini SDK ≤54 şeklinde bayatlamıştı

`expo prebuild` izlenen `android/` dizinini **korur**. Proje SDK 52→55 boyunca
o dizini hiç yenilemedi; SDK 52–54 eski yapıyı kabul ettiği için fark edilmedi.
SDK 55 etmedi:

- `settings.gradle` kaldırılmış `expo/scripts/autolinking.gradle`'ı çağırıyordu
- `app/build.gradle` artık var olmayan `reactAndroidLibs` katalogunu kullanıyordu
- Kök `build.gradle`'daki `ext.kotlinVersion` / `ext.ndkVersion` SDK 55'te yok —
  bunları artık `expo-root-project` plugin'i sağlıyor

Çözüm: `--clean` ile şablondan yeniden üretim + tek gerçek elle yazılmış
özelleştirmenin (release imzalama) plugin'e taşınması.

### Gereksizleşip kaldırılan iki eski düzeltme

| Düzeltme | Neden kaldırıldı |
|---|---|
| Kotlin 1.9.25 sabitlemesi | #494/#509'daki `billing-ktx` metadata çatışması, SDK 55'te `expo-modules-core` **Kotlin 2.1.20**'ye geçtiği için kendiliğinden bitti. 1.9.25'te ısrar artık expo-modules-core'u kırıyordu (Compose Kotlin eklentisi gerekiyor). Ayrıca SDK 55 şablonunda `ext.kotlinVersion` yok — mod tanımsız değişkene atıf yapıyordu. |
| NDK 27 sabitlemesi | SDK 55'te `expo-root-project` plugin'i ndkVersion'ı **varsayılan olarak `27.1.12297006`** yapıyor (`ExpoRootProjectPlugin.kt`). Mod ayrıca yeni şablonda hiç eşleşmiyordu. ⚠️ NDK 27 makinede **kurulu olmalı**: `sdkmanager "ndk;27.1.12297006"` (java PATH'te olmalı, `JAVA_HOME` yetmiyor). |

### Doğrulananlar

- Uygulama açılıyor, çökme yok; **edge-to-edge doğru çalışıyor** — "Eatlas"
  logosu durum çubuğunun altında, alt kenar gezinme çubuğuyla çakışmıyor
- `masked-view` gradyanı ve tüm `@expo/vector-icons` ikonları render ediliyor
- `npm audit`: **0 kritik / 0 yüksek** (Faz 3'te 9 yüksek vardı)

### ⏭️ Emülatörde doğrulanamayanlar

Giriş gerektiren ekranların edge-to-edge turu (5 sekmeli kabuk, restoran/admin
stack'leri, harita, klavye açıkken formlar) ve **#503'ün Sentry kabul kriteri**
("kasıtlı crash üret, Sentry'de okunabilir stack trace gör").
Hepsi `UPGRADE_MANUAL_TESTS.md`'ye eklenecek.

---

## Faz 6 (SDK 56 → 57) — ölçüm sırasında çıkanlar

### 🎯 EPIC hedefi karşılandı: `npm audit` 0 kritik / 0 yüksek

Baseline'da **1 kritik + 11 yüksek** vardı. Zincirin sonunda **0/0**.

Kalan 13 orta bulgunun **hepsi tek bir kök zafiyete** iniyor:

```
uuid@7.0.3  ←  xcode@3.0.1  ←  @expo/config-plugins  ←  expo-splash-screen
```
> `uuid`: v3/v5/v6'da `buf` verildiğinde tampon sınır kontrolü eksik.

**Neden kabul edilebilir:** `xcode` bir **iOS proje dosyası ayrıştırıcısı** —
yalnızca `expo prebuild` sırasında çalışıyor, uygulamaya girmiyor. Üstelik
projede `ios/` dizini yok. Kaynak kodda `uuid` kullanımı **sıfır**.

### 🔴 Global `fetch` değişimi — ÖLÇÜLDÜ, sorun yok

SDK 56'da `expo/fetch` global `fetch` oluyor (`expo/src/winter/runtime.native.ts:52`).
`uploadPhotoToS3` bundan doğrudan etkilenen tek akış: `fetch('file://')` ile
dosyayı okuyup `.blob()` alıyor, sonra S3'e PUT ediyor.

**Statik inceleme** — üç gereksinim de destekleniyor:
| Gereksinim | Nerede |
|---|---|
| `fetch('file://...')` | `OkHttpFileUrlInterceptor.kt` — dosyayı diskten okuyup 200 döndürüyor (`ExpoFetchModule.kt:29`'da kayıtlı) |
| `.blob()` | `FetchResponse.ts:286` |
| Blob gövdeli PUT | `RequestUtils.ts:71` |

**Çalışma anı ölçümü** (debug APK'ya geçici prob konuldu, emülatörde):
```
[FETCHPROBE] file:// yanıt ok= true status= 200  29ms
[FETCHPROBE] blob boyut= 29 (beklenen 29)         3ms
[FETCHPROBE] SONUÇ: BAŞARILI
```

> **Kaçış kapısı:** `EXPO_PUBLIC_USE_RN_FETCH=1` ortam değişkeni RN'in eski
> `fetch`'ini geri getiriyor — tek satırlık geri dönüş.
>
> ⚠️ **Performans notu:** `FetchResponse.blob()` veriyi RN'in blob deposuna
> kopyalayıp base64 ile geri okuyor. Prob'daki 29 baytta önemsiz (3 ms), ama
> **birkaç MB'lık fotoğrafta yavaşlama olabilir**. Expo bu yük için `expo-blob`
> paketini öneriyor. Gerçek yükleme testinde (manuel test 6-2) **süre de
> ölçülmeli**; belirgin yavaşlama varsa `expo-blob` ayrı bir iş olarak eklenir.

### TypeScript 5.9 → 6.0 tsconfig'i kırdı

SDK 56 TypeScript'i ana sürüm atlattı. TS 6 otomatik `@types` yüklemesini
değiştirdiği için `jest` ve `node` global'leri bulunamaz oldu:
**66 test paketi sorunsuz çalışıyordu ama `tsc` 12 hata veriyordu** —
`describe`, `it`, `expect`, `module`, `path`, `__dirname`, `global` bulunamıyor.

`@types/jest`'i 30'a yükseltmek **çözmedi** (paket sürümü sorunu değil).
Çözüm: `tsconfig.json` → `compilerOptions.types = ["jest", "node"]` ve
`@types/node` açık `devDependency`.

### Diğer bağımlılık çakışmaları

| Sorun | Çözüm |
|---|---|
| RN 0.86.3, `@react-native/jest-preset@0.86.3` istiyor ama `jest-expo` 56'da kalmıştı | `jest-expo ~57.0.5` + `babel-preset-expo ~57.0.0` birlikte yükseltildi |
| `react-test-renderer` caret (`^19.2.0`) yüzünden 19.3.0'a kayıyor, o da `react ^19.3.0` istiyor | react ile **birebir aynı sürüme** sabitlendi (`19.2.3`) |
| `node_modules` bayat kalıp ERESOLVE'u tekrarlıyordu | `rm -rf node_modules package-lock.json` + temiz kurulum |

### Doğrulananlar

- `npx expo install --check` → **Dependencies are up to date**
- Uygulama açılıyor, çökme yok; edge-to-edge, logo gradyanı ve tüm ikonlar doğru
- `expo prebuild` sonrası plugin ayarlarının hepsi korundu
  (`newArchEnabled`, `reactNativeArchitectures`, `useLegacyPackaging`, imzalama)

### ⏭️ Emülatörde doğrulanamayan

**Gerçek fotoğraf yükleme akışı** (restoran hesabı + S3 gerekiyor) — `fetch`
mekaniği ölçüldü ama uçtan uca akış değil. `UPGRADE_MANUAL_TESTS.md` §3.10
(6-1…6-4). Ayrıca axios REST ve AI streaming turu §3.11 (6-5…6-7).

---

# Kapanış — öncesi / sonrası (Faz 8)

Zincir tamamlandı: **Expo SDK 52 → 57**, Legacy → **New Architecture**.

| Ölçüm | Öncesi (Faz 0 · SDK 52) | Sonrası (Faz 6 · SDK 57) | Değişim |
|---|---|---|---|
| Expo SDK | 52.0.49 | **57.0.25** | +5 ana sürüm |
| React Native | 0.76.9 | **0.86.3** | +10 minor |
| React | 18.3.1 | **19.2.3** | +1 ana sürüm |
| Mimari | Legacy (Paper) | **New (Fabric + TurboModules + Bridgeless)** | değişti |
| **`npm audit` kritik** | **1** | **0** | 🎯 |
| **`npm audit` yüksek** | **11** | **0** | 🎯 |
| `npm audit` orta | 21 | 13 | ⬇ |
| Test sayısı | 577 (65 suite) | **607 (66 suite)** | +30 |
| Kod tabanı satır kapsamı | %22,34 | %22,39 | ≈ |
| `services/` satır kapsamı | %78,74 | %78,83 | ≈ |
| ESLint hata | 0 | **0** | = |
| `tsc --noEmit` | temiz | **temiz** | = |
| Release APK | 37,8 MiB | 34,4 MiB | ⬇ %9 |
| Soğuk başlangıç (medyan) | 358 ms | 394 ms | ≈ (aralıklar örtüşüyor) |

**EPIC'in asıl gerekçesi karşılandı:** kritik ve yüksek zafiyet **sıfırlandı**.
Kalan 13 orta bulgunun tamamı tek bir kök zafiyete (`uuid` ← `xcode` ←
`@expo/config-plugins`) iniyor ve yalnızca **prebuild zamanı** çalışan iOS
araçlarından geliyor; uygulamaya girmiyor.

## Test borcu denetimi (Faz 8 · madde 1)

| Kriter | Sonuç |
|---|---|
| Test sayısı ≥ 577 | ✅ 607 |
| `services/` kapsamı ≥ %78,73 | ✅ %78,83 |
| Silinen test dosyası | ✅ yok (65 → 66; `dependencyIntegrity.test.ts` eklendi) |
| Devre dışı test (`.skip` / `.only` / `xit`) | ✅ yok |
| ESLint 0 hata · `tsc` temiz | ✅ |

**Kayda geçen test kararları:**

- **`navigation/` için birim testi yazılmadı.** Ekran mount'u gerektiriyor;
  CLAUDE.md'nin *"ağır ekranları mount etme, saf mantığı `utils/`'e çıkar"*
  konvansiyonuna aykırı olurdu. Saf navigasyon hedefi mantığı
  (`utils/notificationTarget.ts`) testli.
- **`theme/icons.ts` için birim testi yazılmadı.** `satisfies Record<string,
  IoniconName>` tiplemesi derleme zamanı garantisi veriyor; Faz 3'te mutasyon
  denetimiyle doğrulandı (geçersiz ikon adı `icons.ts`'in tam o satırında hata
  veriyor). Ayrı test gereksiz.
- **`uploadPhotoToS3` testi mock'lu kalıyor.** Mock, `expo/fetch` değişimini
  yapısı gereği yakalayamaz — bu yüzden gerçek cihaz doğrulaması (manuel test
  6-1…6-4) kabul kriteri olarak duruyor. Faz 6'da `fetch('file://')` mekaniği
  ayrıca cihazda probla ölçüldü.
- **`PaywallScreen` testi yazılmadı** — Faz 7'nin kabul kriteri ve Faz 7 bloke
  (aşağıya bakın).

## `UPGRADE_SMOKE_TEST.md` ne olacak? (Faz 8 · madde 4)

**Korunuyor, arşivlenmiyor.** Gerekçe: A–J listesi yükseltmeye özgü değil,
uygulamanın native yüzeylerinin kalıcı bir regresyon envanteri. Sonraki SDK
yükseltmelerinde ve büyük native değişikliklerde yeniden kullanılacak.
`UPGRADE_MANUAL_TESTS.md` ise **faza özgü** — zincir kapandığında arşivlenebilir.

## 🔴 Faz 7 (expo-iap) BLOKE — kapanışın eksik parçası

Faz 7 (#505) kendi issue'sunda tanımlı zorunlu ön koşulu karşılamadığı için
**başlatılmadı**:

> *"Bu faz, satın alma akışının MEVCUT sürümde (yükseltme öncesi) en az bir kez
> uçtan uca çalıştığı kanıtlanmadan BAŞLATILAMAZ."*

Karşılanmayan ön koşullar:
- Play Console upload key sıfırlama onayı bekliyor
- Satıcı hesabı ve `restaurant_premium` aboneliği henüz tanımlı değil
- Lisanslı test hesabı / Internal Testing kanalı yok
- Smoke-test G1–G4 hiç koşulmadı

**Neden bu kural doğru:** baseline olmadan yükseltilirse ve sonrasında ödeme
çalışmazsa, *"yükseltme mi bozdu, yoksa hiç mi çalışmıyordu?"* sorusuna cevap
verilemez. #493'te `expo-iap`'in native bağımlılıklarının commit'li
`build.gradle`'a hiç enjekte edilmemiş olduğu bulunmuştu — yani akış muhtemelen
hiç çalışmadı. Gelir akışında bu belirsizlik kabul edilemez.

**Sonuç:** `expo-iap` 2.7.14'te kalıyor. SDK 57 + New Architecture ile
paketlendiği ve autolink edildiği doğrulandı; native yüzeyi **Expo Modules API**
olduğu için mimariden bağımsız çalışıyor (Faz 4'te statik olarak incelendi).
Çalışma anı doğrulaması ödeme baseline'ı kurulduğunda yapılacak.