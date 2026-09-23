const { withGradleProperties, withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

function withFixedGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const keys = ['android.overridePathCheck', 'android.kotlinVersion'];
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || !keys.includes(item.key)
    );
    config.modResults.push(
      { type: 'property', key: 'android.overridePathCheck', value: 'true' },
      { type: 'property', key: 'android.kotlinVersion', value: '1.9.25' }
    );
    return config;
  });
}

function withPinnedKotlinVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      "classpath(\"org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}\")"
    );
    return config;
  });
}

/**
 * expo-iap'in config plugin'i (withIAP) app/build.gradle'a şu iki satırı enjekte eder:
 *   implementation "com.android.billingclient:billing-ktx:8.0.0"
 *   implementation "com.google.android.gms:play-services-base:18.1.0"
 *
 * Bunlar app modülünün DERLEME classpath'ine girdiğinde release build KIRILIYOR:
 *   e: billing-ktx-8.0.0 ... compiled with an incompatible version of Kotlin.
 *      The binary version of its metadata is 2.1.0, expected version is 1.9.0.
 * (Proje yukarıda Kotlin 1.9.25'e sabitleniyor.)
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

module.exports = function withAndroidBuildFixes(config) {
  config = withFixedGradleProperties(config);
  config = withPinnedKotlinVersion(config);
  config = withoutIapCompileClasspathDeps(config);
  return config;
};
