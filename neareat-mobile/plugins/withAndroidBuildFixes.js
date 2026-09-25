const { withGradleProperties, withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * NOT — Kotlin 1.9.25 sabitlemesi SDK 55'te KALDIRILDI.
 *
 * Sabitleme #494/#509'daki şu hata yüzünden eklenmişti:
 *   billing-ktx-8.0.0 ... compiled with an incompatible version of Kotlin.
 *   The binary version of its metadata is 2.1.0, expected version is 1.9.0.
 * Yani proje Kotlin 1.9'daydı, bağımlılık 2.1 ile derlenmişti.
 *
 * SDK 55 bu çatışmayı kendiliğinden bitiriyor: `expo-modules-core` artık
 * **Kotlin 2.1.20** kullanıyor ve Compose Kotlin eklentisini gerektiriyor
 * (`org.jetbrains.kotlin.plugin.compose`). 1.9.25'te ısrar etmek artık hatayı
 * çözmüyor, tam tersine expo-modules-core'u kırıyor.
 *
 * Ayrıca SDK 55 şablonunun kök `build.gradle`'ında `ext.kotlinVersion` YOK —
 * eski `withPinnedKotlinVersion` mod'u orada tanımsız bir değişkene atıf yapıyordu
 * ve build'i "Could not get unknown property 'kotlinVersion'" ile kırıyordu.
 * Kotlin sürümünü artık Expo/RN şablonu yönetiyor; biz karışmıyoruz.
 */
function withFixedGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const keys = ['android.overridePathCheck', 'android.kotlinVersion'];
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || !keys.includes(item.key)
    );
    config.modResults.push(
      { type: 'property', key: 'android.overridePathCheck', value: 'true' }
    );
    return config;
  });
}

/**
 * NOT — NDK sürümü sabitlemesi SDK 55'te KALDIRILDI.
 *
 * Faz 4'te (Yeni Mimari) şu hata çıkmıştı:
 *   graphicsConversions.h:80: error: no member named 'format' in namespace 'std'
 * RN'in C++ başlıkları `std::format` (C++20) kullanıyor; NDK 26'nın libc++'ında
 * yok, NDK 27 (clang 18) ile geldi. O zaman ndkVersion elle 27'ye çekilmişti.
 *
 * SDK 55'te buna gerek kalmadı: kök `build.gradle` artık `expo-root-project`
 * plugin'ini uyguluyor ve o plugin ndkVersion'ı **varsayılan olarak
 * "27.1.12297006"** yapıyor (ExpoRootProjectPlugin.kt). Eski mod ayrıca
 * çalışmıyordu da — SDK 55 şablonunun kök build.gradle'ında sabitlemenin
 * hedef aldığı `ndkVersion = "..."` satırı hiç yok.
 *
 * ⚠️ Makinede NDK 27.1.12297006 KURULU OLMALI:
 *   sdkmanager "ndk;27.1.12297006"   (java PATH'te olmalı, JAVA_HOME yetmiyor)
 */

/**
 * expo-iap'in config plugin'i (withIAP) app/build.gradle'a şu iki satırı enjekte eder:
 *   implementation "com.android.billingclient:billing-ktx:8.0.0"
 *   implementation "com.google.android.gms:play-services-base:18.1.0"
 *
 * Bunlar app modülünün DERLEME classpath'ine girdiğinde release build KIRILIYOR:
 *   e: billing-ktx-8.0.0 ... compiled with an incompatible version of Kotlin.
 *      The binary version of its metadata is 2.1.0, expected version is 1.9.0.
 * (O tarihte proje Kotlin 1.9.25'e sabitlenmişti; SDK 55'te sabitleme kalktı
 *  ve Kotlin 2.1.20 kullanılıyor, yani bu çatışma artık geçerli değil. Satırların
 *  temizlenmesi yine de doğru: gereksizler ve #509'da ölçüldüğü gibi etkisizler.)
 *
 * Satırlar GEREKSİZ: expo-iap'in kendi android/build.gradle'ı aynı bağımlılıkları
 * zaten `implementation` olarak tanımlıyor; Gradle modül bağımlılıkları çalışma
 * zamanında geçişli olduğu için sınıflar APK'ya yine giriyor (PR #509'da dex
 * içeriği ölçülerek doğrulandı). Yani tek etkileri derlemeyi kırmak.
 *
 * #494'te elle silinmişti ama `expo prebuild` her çalıştığında geri geliyor.
 * Burada temizlemek, prebuild'i tekrar çalıştırmayı güvenli kılar.
 */
function withoutIapCompileClasspathDeps(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents
      .replace(/^[ \t]*implementation "com\.android\.billingclient:billing-ktx:[^"]*"\r?\n/gm, '')
      .replace(/^[ \t]*implementation "com\.google\.android\.gms:play-services-base:[^"]*"\r?\n/gm, '');
    return config;
  });
}

/**
 * Release imzalama yapılandırması (S13-7).
 *
 * Şifreler BU DOSYADA DEĞİL — `~/.gradle/gradle.properties` (repo dışı) içinde:
 *   NEAREAT_UPLOAD_STORE_FILE, NEAREAT_UPLOAD_KEY_ALIAS,
 *   NEAREAT_UPLOAD_STORE_PASSWORD, NEAREAT_UPLOAD_KEY_PASSWORD
 *
 * Upload keystore tanımlı VE dosyası mevcutsa onunla, değilse (yerel test
 * build'i) debug anahtarıyla imzalanır. Debug imzasının SHA-1'i Google Cloud'a
 * kayıtlı olduğu için test APK'sında Google Giriş çalışır ve APK Metro'suz
 * kurulabilir.
 *
 * NEDEN PLUGIN: Bu blok eskiden elle `android/app/build.gradle`'a yazılmıştı.
 * `expo prebuild` o dosyayı KORUDUĞU için SDK yükseltmelerinde dosya bayatladı
 * ve SDK 55'te build'i kırdı (eski `reactAndroidLibs` katalogu, eski
 * `hermesCommand` yolu, `enableProguardInReleaseBuilds` → artık
 * `enableMinifyInReleaseBuilds`). Dosyayı SDK 55 şablonundan yeniden üretip
 * özelleştirmeyi buraya taşımak, aynı bayatlamanın tekrarını önlüyor.
 */
function withReleaseSigningConfig(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('NEAREAT_UPLOAD_STORE_FILE')) {
      // 1) signingConfigs bloğuna `release` ekle (debug bloğundan hemen sonra)
      contents = contents.replace(
        /(signingConfigs \{[\s\S]*?debug \{[\s\S]*?\n {8}\}\n)/,
        `$1        release {
            if (project.hasProperty('NEAREAT_UPLOAD_STORE_FILE') && file(NEAREAT_UPLOAD_STORE_FILE).exists()) {
                storeFile file(NEAREAT_UPLOAD_STORE_FILE)
                storePassword NEAREAT_UPLOAD_STORE_PASSWORD
                keyAlias NEAREAT_UPLOAD_KEY_ALIAS
                keyPassword NEAREAT_UPLOAD_KEY_PASSWORD
            }
        }\n`
      );

      // 2) release buildType'ın şablondaki `signingConfig signingConfigs.debug`
      //    satırını koşullu seçimle değiştir
      contents = contents.replace(
        /\/\/ Caution! In production[\s\S]*?signingConfig signingConfigs\.debug/,
        `def hasUploadKeystore = project.hasProperty('NEAREAT_UPLOAD_STORE_FILE') && file(NEAREAT_UPLOAD_STORE_FILE).exists()
            signingConfig hasUploadKeystore ? signingConfigs.release : signingConfigs.debug`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withAndroidBuildFixes(config) {
  config = withFixedGradleProperties(config);
  config = withReleaseSigningConfig(config);
  config = withoutIapCompileClasspathDeps(config);
  return config;
};
