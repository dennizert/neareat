'use strict';

/**
 * Yapılandırılmış log (S21-2).
 *
 * Makale §7.3'ün asgari log alanları listesi `correlationId` içeriyor. Bugüne kadar
 * `requestId` yalnızca hata ve güvenlik loglarına işleniyordu — rutin akışta bir isteği
 * uçtan uca izlemek mümkün değildi.
 *
 * Bu sarmalayıcı ince tutuldu: `console` yerine geçer, satıra bağlamı (requestId / job)
 * ve zaman damgasını otomatik ekler. Harici bir log kütüphanesi (pino/winston) kasıtlı
 * olarak eklenmedi — 12-Factor gereği çıktı zaten stdout'a gidiyor ve Railway onu topluyor;
 * bağımlılık eklemeden çözülebilen bir problem için bağımlılık eklenmedi.
 */

const { getContext } = require('./requestContext');

const LEVELS = Object.freeze(['debug', 'info', 'warn', 'error']);

/**
 * Log satırlarında ASLA görünmemesi gereken anahtarlar. Sentry'nin `beforeSend`
 * temizliğiyle (S14-B3) tutarlı tutulur.
 */
const SENSITIVE_KEY_PATTERN = /pass(word)?|token|secret|authorization|apikey|api_key|credential/i;
const REDACTED = '[REDACTED]';

/**
 * Meta nesnesindeki hassas alanları maskeler. Derinlik sınırlıdır: log meta'sı sığdır ve
 * sınırsız özyineleme, döngüsel referansta sonsuz döngüye girer.
 */
function scrub(value, depth = 0) {
  if (depth > 3 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrub(val, depth + 1);
  }
  return out;
}

// Testlerde log gürültüsü CI çıktısını okunamaz hale getirir; sessiz varsayılan.
function isSilent() {
  return process.env.NODE_ENV === 'test' && process.env.LOG_IN_TESTS !== 'true';
}

// Üretimde JSON (makine tarafından ayrıştırılabilir), geliştirmede okunabilir tek satır.
function isJsonOutput() {
  return process.env.NODE_ENV === 'production';
}

function defaultSink(level, entry) {
  const line = isJsonOutput()
    ? JSON.stringify(entry)
    : `[${entry.level.toUpperCase()}]${entry.requestId ? ` (${entry.requestId.slice(0, 8)})` : ''}` +
      `${entry.job ? ` (job:${entry.job})` : ''} ${entry.message}` +
      (entry.meta ? ` ${JSON.stringify(entry.meta)}` : '');

  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

let _sink = defaultSink;

/** Çıktı hedefini değiştirir (testler için). Argümansız çağrı varsayılana döner. */
function setSink(fn) {
  _sink = typeof fn === 'function' ? fn : defaultSink;
}

function emit(level, message, meta) {
  if (isSilent()) return;

  const ctx = getContext();
  const entry = {
    level,
    time: new Date().toISOString(),
    message: String(message),
  };
  // Bağlam yoksa alanlar hiç eklenmez — boş bir `requestId: null` gürültüdür.
  if (ctx && ctx.requestId) entry.requestId = ctx.requestId;
  if (ctx && ctx.job) entry.job = ctx.job;
  if (meta !== undefined && meta !== null) entry.meta = scrub(meta);

  try {
    _sink(level, entry);
  } catch {
    // Log yazımı asla uygulamayı düşürmemeli.
  }
}

const logger = LEVELS.reduce((acc, level) => {
  acc[level] = (message, meta) => emit(level, message, meta);
  return acc;
}, {});

module.exports = { ...logger, setSink, scrub, LEVELS };
