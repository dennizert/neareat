'use strict';

// S18-3: Yıldız "farming" önleme. Özellikler artık yıldız seviyesine bağlı olduğu için
// yıldız üretmek cazip hale geldi. Yıldızı TAKLİT ETMESİ ZOR (gerçek ziyaret) aksiyonlara
// bağlıyoruz + tip bazlı günlük tavan koyuyoruz. Saf yardımcılar + DB'ye dokunan async
// fonksiyonlar birlikte (test edilebilirlik için saf çekirdek ayrı export edilir).

const prisma = require('./prisma');

// Tip bazlı günlük yıldız OLAYı tavanı (env ile ayarlanabilir; 0 → tavan yok).
// Taklit edilmesi kolay (yorum/puan) tiplerde düşük tutulur; rezervasyon/gitme zaten zor.
const STAR_DAILY_CAPS = {
  REVIEW: parseInt(process.env.STAR_DAILY_CAP_REVIEW || '3', 10),
  RATING: parseInt(process.env.STAR_DAILY_CAP_RATING || '5', 10),
};

/**
 * İstanbul gece yarısı (UTC+3, DST yok) → UTC. "Bugün" penceresi için. Saf.
 */
function getIstanbulMidnightUtc(now = new Date()) {
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  istanbul.setUTCHours(0, 0, 0, 0);
  return new Date(istanbul.getTime() - 3 * 60 * 60 * 1000);
}

/**
 * Saf tavan kontrolü: bugünkü sayı tavanın altında mı? (cap ≤ 0 → tavan yok → true)
 */
function withinDailyCap(todayCount, cap) {
  if (!cap || cap <= 0) return true;
  return todayCount < cap;
}

/**
 * Kullanıcının placeId'de DOĞRULANMIŞ ZİYARETİ var mı?
 * (check-in VEYA tamamlanmış — attended=true — rezervasyon). Sahte yorum/puanla
 * seviye atlamayı engeller. DB sorgusu yapar.
 */
async function hasVerifiedVisit(userId, placeId) {
  const [checkIn, reservation] = await Promise.all([
    prisma.checkIn.findFirst({ where: { userId, placeId }, select: { id: true } }),
    prisma.reservation.findFirst({ where: { userId, placeId, attended: true }, select: { id: true } }),
  ]);
  return !!(checkIn || reservation);
}

/**
 * Bu tip için bugün verilen (pozitif) yıldız olayı sayısı tavanın altında mı? DB sorgusu yapar.
 */
async function isUnderDailyStarCap(userId, type) {
  const cap = STAR_DAILY_CAPS[type];
  if (!cap || cap <= 0) return true;
  const todayCount = await prisma.starEvent.count({
    where: { userId, type, amount: { gt: 0 }, createdAt: { gte: getIstanbulMidnightUtc() } },
  });
  return withinDailyCap(todayCount, cap);
}

/**
 * Bir mekân-bağlı yıldız (REVIEW/RATING) verilebilir mi?
 * Hem doğrulanmış ziyaret hem günlük tavan koşulu sağlanmalı.
 */
async function canEarnPlaceStars(userId, placeId, type) {
  const [visited, underCap] = await Promise.all([
    hasVerifiedVisit(userId, placeId),
    isUnderDailyStarCap(userId, type),
  ]);
  return { visited, underCap, allowed: visited && underCap };
}

module.exports = {
  STAR_DAILY_CAPS,
  getIstanbulMidnightUtc,
  withinDailyCap,
  hasVerifiedVisit,
  isUnderDailyStarCap,
  canEarnPlaceStars,
};
