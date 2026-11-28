// Boot anında ortam değişkeni doğrulaması (S12-2).
//
// Amaç: Yanlış yapılandırılmış bir ÜRETİM örneğinin sessizce güvenliği zayıflatmasını
// engellemek (fail-closed). Örn. TOKEN_HASH_SECRET unutulursa tokenHash.js sabit bir
// fallback'e düşer ve e-posta/şifre token'ları taklit edilebilir hale gelir — bu
// doğrulama prod'da böyle bir başlatmayı reddeder.
//
// validateEnv(env) saf bir fonksiyondur (process'e dokunmaz) → kolay test edilir.
// assertEnvOrExit(env) ise sonucu loglar ve prod'da hata varsa exit(1) yapar.

const { isValidOrigin } = require('./webOrigin');

const MIN_SECRET_LENGTH = 32;

// Üretimde MUTLAKA tanımlı olması gereken değişkenler (eksikse fail-closed).
const REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'DATABASE_URL', 'TOKEN_HASH_SECRET'];

// Uzunluğu denetlenen secret'lar — zayıf/kısa değer prod'da hata, dev'de uyarı.
const LENGTH_CHECKED_SECRETS = ['JWT_SECRET', 'TOKEN_HASH_SECRET'];

// Eksikliği kritik değil ama önerilir — her ortamda yalnızca uyarı.
const RECOMMENDED = ['ALLOWED_ORIGINS', 'ANTHROPIC_API_KEY', 'GOOGLE_PLACES_API_KEY', 'REDIS_URL'];

// Şablon/yer-tutucu izleri. Uzunluk kontrolünü geçen ama TAHMİN EDİLEBİLİR bir secret
// (örn. "...-change-in-production") imza anahtarı olarak kullanılırsa, değeri tahmin eden
// biri istediği kullanıcı için token üretebilir. Yalnızca UYARI: ölümcül yapmak, rotasyon
// öncesi bir deploy'da sunucuyu açılmaz hale getirir.
const PLACEHOLDER_PATTERNS = [
  'change-in-production', 'changeme', 'change-me', 'your-secret',
  'replace-me', 'placeholder', 'example', 'todo',
];

function looksLikePlaceholder(value) {
  const v = String(value).toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => v.includes(p));
}

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Ortam değişkenlerini doğrular.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === 'production';

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (isPresent(env[key])) continue;
    if (isProduction) {
      errors.push(`${key} tanımlı değil — üretimde zorunlu (eksikse güvenlik zafiyeti).`);
    } else {
      warnings.push(`${key} tanımlı değil — üretimde zorunlu olacak.`);
    }
  }

  for (const key of LENGTH_CHECKED_SECRETS) {
    const value = env[key];
    if (!isPresent(value) || value.trim().length >= MIN_SECRET_LENGTH) continue;
    const msg = `${key} çok kısa (< ${MIN_SECRET_LENGTH} karakter) — uzun rastgele bir değer kullanın.`;
    if (isProduction) errors.push(msg);
    else warnings.push(msg);
  }

  // Uzunluk yeterli olsa bile şablon değeri tahmin edilebilir → imza anahtarı için kritik.
  for (const key of LENGTH_CHECKED_SECRETS) {
    const value = env[key];
    if (!isPresent(value) || !looksLikePlaceholder(value)) continue;
    warnings.push(
      `${key} şablon/yer-tutucu bir değere benziyor — tahmin edilebilir bir imza anahtarı ` +
      'hesap devralmaya izin verir. Rastgele bir değerle değiştirin ' +
      '(JWT_PREVIOUS_SECRET ile kesintisiz rotasyon mümkün).',
    );
  }

  for (const key of RECOMMENDED) {
    if (!isPresent(env[key])) {
      warnings.push(`${key} tanımlı değil — ilgili özellik düzgün çalışmayabilir.`);
    }
  }

  return { errors, warnings };
}

/**
 * Web paneli env doğrulaması (#525). `validateEnv`'den AYRI tutuldu: o fonksiyonun mevcut
 * testleri "tam üretim yapılandırması" sözleşmesini sabitliyor ve iş emri mevcut testlerin
 * değiştirilmemesini istiyor. `assertEnvOrExit` ikisini birlikte uygular → açılış davranışı
 * tek yerden yönetilir.
 *
 * Üretimde `PUBLIC_WEB_ORIGIN` zorunludur: yoksa CSRF Origin kontrolü bütün panel yazma
 * isteklerini reddeder ve şifre sıfırlama bağlantısı panele gidemez.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateWebPanelEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === 'production';
  const value = env.PUBLIC_WEB_ORIGIN;

  if (!isPresent(value)) {
    const msg = 'PUBLIC_WEB_ORIGIN tanımlı değil — web paneli (CSRF Origin kontrolü, CORS, panel şifre sıfırlama bağlantısı) çalışmaz.';
    if (isProduction) errors.push(`${msg} Üretimde zorunlu.`);
    else warnings.push(msg);
  } else if (!isValidOrigin(value)) {
    const msg = `PUBLIC_WEB_ORIGIN geçerli bir origin değil ("${value}") — yalnızca şema + host olmalı (örn. https://panel.example.com).`;
    if (isProduction) errors.push(msg);
    else warnings.push(msg);
  } else if (isProduction && !String(value).trim().startsWith('https://')) {
    errors.push('PUBLIC_WEB_ORIGIN üretimde https:// olmalı (`__Host-` çerezi Secure ister).');
  }

  return { errors, warnings };
}

/**
 * validateEnv sonucunu loglar; üretimde hata varsa süreci sonlandırır (fail-closed).
 * Test ortamında (NODE_ENV=test) çağrılmaz — bkz. app.js.
 * @param {NodeJS.ProcessEnv} env
 */
function assertEnvOrExit(env = process.env) {
  const base = validateEnv(env);
  const web = validateWebPanelEnv(env);
  const errors = [...base.errors, ...web.errors];
  const warnings = [...base.warnings, ...web.warnings];

  for (const w of warnings) console.warn('[ENV][warn]', w);

  if (errors.length) {
    for (const e of errors) console.error('[ENV][FATAL]', e);
    console.error(`[ENV][FATAL] ${errors.length} kritik yapılandırma hatası — sunucu başlatılmıyor.`);
    process.exit(1);
  }
}

module.exports = {
  validateEnv,
  validateWebPanelEnv,
  assertEnvOrExit,
  MIN_SECRET_LENGTH,
  REQUIRED_IN_PRODUCTION,
  RECOMMENDED,
};
