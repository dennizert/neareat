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
| `eatlas-sdk52-pre-faz1-v2.0.14-vc42.apk` | `~/eatlas-upgrade-archive/` | 37,8 MB, debug imzalı, emülatörde çalıştığı doğrulandı |
| `eatlas-sdk52-pre-faz1-v2.0.14-vc42.aab` | `~/eatlas-upgrade-archive/` | 38,5 MB, debug imzalı |

Git etiketi: **`mobile-pre-faz1`**

> ⚠️ Arşiv dizini repo dışında ve `.gitignore` zaten `*.apk`/`*.aab` içeriyor.
> Bu dizin **yedeklenmeli** (harici disk / bulut) — kaybolursa geri dönüş yolu zayıflar.

---

## Sonraki fazlar için ölçüm şablonu

Her faz kendi sütununu ekler:

| Ölçüm | Faz 0 (SDK 52) | Faz 2 (SDK 53) | Faz 3 (SDK 54) | Faz 4 (New Arch) | Faz 5 (SDK 55) | Faz 6 (SDK 57) |
|---|---|---|---|---|---|---|
| Test sayısı | 577 | | | | | |
| Kod tabanı kapsamı | %22,34 | | | | | |
| `services/` kapsamı | %78,74 | | | | | |
| ESLint hata | 0 | | | | | |
| `npm audit` (K/Y/O) | 1/11/21 | | | | | |
| APK boyutu | 37,8 MB | | | | | |
| Soğuk başlangıç | 358 ms | | | | | |
| `node_modules` | 503 MB | | | | | |
