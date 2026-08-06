'use strict';

/**
 * Mobil bağımlılık güvenliği kapısı (S25-1).
 *
 * NEDEN DÜZ `npm audit --audit-level=high` DEĞİL:
 * Mobil paketin high/critical bulgularının neredeyse tamamı Expo ve React Native'in
 * DERLEME zincirinden geliyor (`@expo/cli`, `metro-config`, `react-devtools-core`…) —
 * APK'ya girmiyorlar ve düzeltilmeleri Expo'nun sürüm çizelgesine bağlı, bizim elimizde
 * değil. Düz bir kapı ilk günden kırmızı olurdu; kalıcı kırmızı bir kapı, kapı olmayan
 * bir kapıdır — herkes görmezden gelmeyi öğrenir.
 *
 * Bu yüzden: GEREKÇELİ ve SÜRELİ muafiyet. Kapı, allowlist'te olmayan her high/critical
 * bulguda kırılır. Allowlist'teki her kaydın gerekçesi, zinciri ve bir `reviewBy` tarihi
 * vardır; tarihi geçen kayıt YENİDEN BLOKLAYICI olur. Süresiz muafiyet "sonsuza kadar
 * görmezden gel" demektir; süreli muafiyet periyodik olarak bilinçli karar vermeye zorlar.
 * (Aynı fikir `utils/userDto.js` şema korumasında ve `load-tests/lib/guard.js`'te de var.)
 */

const SEVERITY_ORDER = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/** Bir kaydın taşıması ZORUNLU alanları — eksikse muafiyet geçersiz sayılır (bkz. R1). */
const REQUIRED_ENTRY_FIELDS = ['package', 'severity', 'chain', 'reason', 'reviewBy'];

/**
 * Muafiyet kaydının biçimsel geçerliliği.
 *
 * Geçersiz kaydı sessizce yok saymak, kapıyı gizlice gevşetirdi: gerekçesi silinmiş bir
 * kayıt hâlâ muafiyet üretirdi. Bunun yerine geçersiz kayıt BLOKLAR — yani hatalı
 * allowlist, güvenlik boşluğu değil CI hatası üretir.
 *
 * @returns {string|null} sorun açıklaması, sorun yoksa null
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'kayıt bir nesne değil';

  const missing = REQUIRED_ENTRY_FIELDS.filter((f) => !entry[f]);
  if (missing.length) return `zorunlu alan eksik: ${missing.join(', ')}`;

  if (!(entry.severity in SEVERITY_ORDER)) return `bilinmeyen şiddet: ${entry.severity}`;

  const reviewBy = new Date(entry.reviewBy);
  if (Number.isNaN(reviewBy.getTime())) return `geçersiz reviewBy tarihi: ${entry.reviewBy}`;

  return null;
}

/**
 * SAF karar çekirdeği — `npm audit --json` çıktısı + allowlist → karar.
 *
 * Dış dünyaya (dosya sistemi, süreç, ağ) hiç dokunmaz; `now` bile enjekte edilir, böylece
 * "muafiyetin süresi doldu" davranışı gerçek takvime bakmadan test edilebilir.
 *
 * @param {object}   p
 * @param {object}   p.auditJson  `npm audit --json` çıktısı (ayrıştırılmış)
 * @param {object}   p.allowlist  `{ entries: [...] }`
 * @param {string}   [p.level]    bu şiddet ve üzeri dikkate alınır (varsayılan 'high')
 * @param {Date}     [p.now]      "şimdi" — süre dolumu kararı için
 * @returns {{ blocking: object[], allowed: object[], stale: string[] }}
 */
function evaluateAudit({ auditJson, allowlist, level = 'high', now = new Date() }) {
  const threshold = SEVERITY_ORDER[level];
  if (threshold === undefined) throw new Error(`bilinmeyen şiddet seviyesi: ${level}`);

  const entries = (allowlist && allowlist.entries) || [];
  const byPackage = new Map(entries.map((e) => [e && e.package, e]));

  const findings = Object.values((auditJson && auditJson.vulnerabilities) || {}).filter(
    (v) => SEVERITY_ORDER[v.severity] >= threshold,
  );

  const blocking = [];
  const allowed = [];
  const matchedPackages = new Set();

  for (const finding of findings) {
    const entry = byPackage.get(finding.name);
    const base = { package: finding.name, severity: finding.severity };

    if (!entry) {
      blocking.push({ ...base, why: 'not-allowlisted' });
      continue;
    }
    matchedPackages.add(finding.name);

    const problem = validateEntry(entry);
    if (problem) {
      blocking.push({ ...base, why: 'invalid-entry', detail: problem });
      continue;
    }

    // Bulgunun şiddeti muafiyet verildiği andakinden YÜKSELDİYSE muafiyet düşer.
    // Yeniden puanlanmış bir advisory, kararın yeniden verilmesi gereken andır.
    if (SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[entry.severity]) {
      blocking.push({
        ...base,
        why: 'severity-escalated',
        detail: `muafiyet ${entry.severity} için verilmişti, bulgu artık ${finding.severity}`,
      });
      continue;
    }

    if (new Date(entry.reviewBy) < now) {
      blocking.push({ ...base, why: 'expired', detail: `gözden geçirme tarihi: ${entry.reviewBy}` });
      continue;
    }

    allowed.push({ ...base, reviewBy: entry.reviewBy, reason: entry.reason });
  }

  // Karşılığı kalmayan muafiyetler: bloklamaz (bulgu zaten yok) ama raporlanır ki
  // allowlist çürümesin. Temizlenmeyen bir muafiyet, ileride başka bir bulguyu
  // farkında olmadan affedebilir.
  const stale = entries
    .map((e) => e && e.package)
    .filter((name) => name && !matchedPackages.has(name));

  return { blocking, allowed, stale };
}

module.exports = { evaluateAudit, validateEntry, SEVERITY_ORDER, REQUIRED_ENTRY_FIELDS };
