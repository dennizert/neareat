/**
 * Sezon Sıfırlama job'ı (S18-4).
 *
 * Kullanıcıları aktif tutmak için sezonluk yıldız (User.starCount) 6 ayda bir sıfırlanır.
 * KARAR: herkes 2 SEVİYE DÜŞER, taban L2 (L5→L3=100, diğerleri→L2=50). En sadık kullanıcıyı
 * dibe vurdurmaz ama aktiflik baskısı korur. Kalıcı `StarEvent` defteri SİLİNMEZ (sezonluk
 * yıldız ≠ ömür-boyu denetim defteri); yalnızca seviye-belirleyen sayaç sıfırlanır.
 *
 * Çapa: `User.seasonStartAt` (sıfırlama anında tüm kullanıcılarda `now`a eşitlenir → "şu anki
 * sezon başlangıcı" = en son seasonStartAt). Bootstrap (hepsi null) → baseline kurulur, sıfırlama
 * YAPILMAZ. Sonraki günlük tetikte 6 ay dolduysa sıfırlama çalışır → idempotent (çapa ilerler).
 *
 * Ölçek-güvenli: yeni starCount yalnızca İKİ değerden biri (50 / 100) olduğundan, kullanıcı
 * başına satır yerine L5-eşiği (250) sınırında 2 `updateMany` ile tüm tablo güncellenir.
 * Audit: 10k StarEvent yerine tek sistem olayı (`logSecurityEvent SEASON_RESET`).
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { LEVEL_THRESHOLDS, computeSeasonResetStars } = require('../utils/stars');
const { withCronLock } = require('../services/cronLock');
const { logSecurityEvent } = require('../middleware/securityLogger');

// Sezon süresi (ms) — varsayılan ~6 ay (183 gün). Test/operasyon için env ile ayarlanabilir.
const SEASON_DURATION_MS = parseInt(process.env.SEASON_DURATION_MS || `${183 * 24 * 60 * 60 * 1000}`, 10);

// L5 eşiği (250) → bu sınırın altı/üstü iki bucket. Hedef değerler saf fonksiyondan türetilir
// (eşikler değişirse uyumlu kalır): altı → 50 (L2), üstü → 100 (L3).
const L5_FLOOR = LEVEL_THRESHOLDS[5];
const BELOW_TARGET = computeSeasonResetStars(0);           // L1–L4 → 50
const ABOVE_TARGET = computeSeasonResetStars(L5_FLOOR);    // L5 → 100

/**
 * Geçerli sezon çapasını döndürür (en son seasonStartAt) — yoksa null (bootstrap gerek).
 */
async function getSeasonAnchor() {
  const row = await prisma.user.findFirst({
    where: { seasonStartAt: { not: null } },
    orderBy: { seasonStartAt: 'desc' },
    select: { seasonStartAt: true },
  });
  return row?.seasonStartAt ?? null;
}

/**
 * Sezon sıfırlama işini çalıştırır.
 * @param {{ force?: boolean, now?: Date }} [opts] force: süre kontrolünü atla (admin/test).
 * @returns {Promise<{ action:'bootstrap'|'reset'|'skipped', ... }>}
 */
async function runSeasonResetJob(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  try {
    const anchor = await getSeasonAnchor();

    // Bootstrap — hiç sezon başlatılmamış: baseline kur, sıfırlama yapma.
    if (!anchor) {
      const { count } = await prisma.user.updateMany({
        where: { seasonStartAt: null },
        data: { seasonStartAt: now },
      });
      console.log(`[seasonReset] baseline kuruldu (${count} kullanıcı), sıfırlama yapılmadı`);
      return { action: 'bootstrap', baselined: count };
    }

    // Süre dolmadıysa (ve force değilse) → no-op
    const elapsed = now.getTime() - new Date(anchor).getTime();
    if (!opts.force && elapsed < SEASON_DURATION_MS) {
      return { action: 'skipped', reason: 'not_due', elapsedMs: elapsed };
    }

    // Sıfırlama — ÖNCE alt bucket (L5 eşiğinin altı) → 50, SONRA üst bucket (L5) → 100.
    // Bu sıra çift-güncellemeyi önler: alt bucket 50'ye inince <250 kalır; üst updateMany
    // yalnızca dokunulmamış ≥250 kullanıcıları yakalar.
    const below = await prisma.user.updateMany({
      where: { starCount: { lt: L5_FLOOR } },
      data: { starCount: BELOW_TARGET, seasonStartAt: now },
    });
    const above = await prisma.user.updateMany({
      where: { starCount: { gte: L5_FLOOR } },
      data: { starCount: ABOVE_TARGET, seasonStartAt: now },
    });

    const summary = { action: 'reset', demotedToL2: below.count, demotedToL3: above.count, at: now.toISOString() };
    logSecurityEvent('SEASON_RESET', summary);
    console.log(`[seasonReset] sezon sıfırlandı — L2:${below.count} L3:${above.count}`);
    return summary;
  } catch (err) {
    console.error('[seasonReset] error:', err.message);
    return { action: 'skipped', error: err.message };
  }
}

function scheduleSeasonReset() {
  // Her gün 04:00 (Türkiye) kontrol et; sezon dolduysa sıfırla (replika-güvenli kilit).
  cron.schedule('0 4 * * *', () => withCronLock('seasonReset', runSeasonResetJob), { timezone: 'Europe/Istanbul' });
}

module.exports = { scheduleSeasonReset, runSeasonResetJob, getSeasonAnchor, SEASON_DURATION_MS, BELOW_TARGET, ABOVE_TARGET, L5_FLOOR };
