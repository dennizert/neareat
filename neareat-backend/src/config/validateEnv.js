// Boot anında ortam değişkeni doğrulaması (S12-2).
//
// Amaç: Yanlış yapılandırılmış bir ÜRETİM örneğinin sessizce güvenliği zayıflatmasını
// engellemek (fail-closed). Örn. TOKEN_HASH_SECRET unutulursa tokenHash.js sabit bir
// fallback'e düşer ve e-posta/şifre token'ları taklit edilebilir hale gelir — bu
// doğrulama prod'da böyle bir başlatmayı reddeder.
//
// validateEnv(env) saf bir fonksiyondur (process'e dokunmaz) → kolay test edilir.
// assertEnvOrExit(env) ise sonucu loglar ve prod'da hata varsa exit(1) yapar.

const MIN_SECRET_LENGTH = 32;

// Üretimde MUTLAKA tanımlı olması gereken değişkenler (eksikse fail-closed).
const REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'DATABASE_URL', 'TOKEN_HASH_SECRET'];

// Uzunluğu denetlenen secret'lar — zayıf/kısa değer prod'da hata, dev'de uyarı.
const LENGTH_CHECKED_SECRETS = ['JWT_SECRET', 'TOKEN_HASH_SECRET'];

// Eksikliği kritik değil ama önerilir — her ortamda yalnızca uyarı.
const RECOMMENDED = ['ALLOWED_ORIGINS', 'ANTHROPIC_API_KEY', 'GOOGLE_PLACES_API_KEY', 'REDIS_URL'];

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

  for (const key of RECOMMENDED) {
    if (!isPresent(env[key])) {
      warnings.push(`${key} tanımlı değil — ilgili özellik düzgün çalışmayabilir.`);
    }
  }

  return { errors, warnings };
}

/**
 * validateEnv sonucunu loglar; üretimde hata varsa süreci sonlandırır (fail-closed).
 * Test ortamında (NODE_ENV=test) çağrılmaz — bkz. app.js.
 * @param {NodeJS.ProcessEnv} env
 */
function assertEnvOrExit(env = process.env) {
  const { errors, warnings } = validateEnv(env);

  for (const w of warnings) console.warn('[ENV][warn]', w);

  if (errors.length) {
    for (const e of errors) console.error('[ENV][FATAL]', e);
    console.error(`[ENV][FATAL] ${errors.length} kritik yapılandırma hatası — sunucu başlatılmıyor.`);
    process.exit(1);
  }
}

module.exports = {
  validateEnv,
  assertEnvOrExit,
  MIN_SECRET_LENGTH,
  REQUIRED_IN_PRODUCTION,
  RECOMMENDED,
};
