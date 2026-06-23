'use strict';

// S18-3: Referral sertleştirme. Sahte hesap çiftliğiyle davet-eden yıldızı farming'ini
// engellemek için, davet EDEN kişinin yıldızı ANINDA verilmez. Davet edilen kullanıcı
// (1) e-postasını DOĞRULAYIP (2) ilk ANLAMLI aksiyonunu (rezervasyon / doğrulanmış yorum)
// yaptığında verilir. Bekleyen davet-eden bağı Redis'te tutulur (şema değişikliği yok).

const prisma = require('../utils/prisma');
const { awardStars } = require('../utils/stars');
const { cacheGet, cacheSet, cacheDel } = require('./redis');

const REFERRER_STARS_TYPE = 'REFERRAL';
// Bekleyen referral bağı TTL'i (sn). Davet bu süre içinde "anlamlı aksiyon"a dönüşmezse düşer.
const PENDING_TTL = parseInt(process.env.REFERRAL_PENDING_TTL || `${30 * 24 * 60 * 60}`, 10);

function pendingKey(referredUserId) {
  return `pending-referral:${referredUserId}`;
}

/**
 * applyCode anında çağrılır: davet edilen → davet eden bağını bekleyen olarak işaretler.
 * Davet edenin yıldızı henüz VERİLMEZ (maybeAwardReferrer ile sonra verilir).
 */
async function markPendingReferral(referredUserId, referrerId) {
  await cacheSet(pendingKey(referredUserId), referrerId, PENDING_TTL).catch(() => {});
}

/**
 * Davet edilen kullanıcı anlamlı bir aksiyon yaptığında (rezervasyon / doğrulanmış yorum)
 * çağrılır. Koşullar sağlanıyorsa davet edene REFERRAL yıldızı verir. Idempotent:
 * (referrer, referredUserId) için yıldız bir kez verilir; verince bekleyen bağ silinir.
 * Fire-and-forget kullanılması beklenir (hata yutulur).
 */
async function maybeAwardReferrer(referredUserId) {
  const referrerId = await cacheGet(pendingKey(referredUserId));
  if (!referrerId) return;

  const user = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { emailVerified: true, displayName: true },
  });
  // E-posta doğrulanmadıysa bağı koru (sonra tekrar denenebilir).
  if (!user || !user.emailVerified) return;

  // Idempotency — bu davet için davet eden zaten ödüllendirildiyse bağı temizle, çık.
  const already = await prisma.starEvent.findFirst({
    where: { userId: referrerId, type: REFERRER_STARS_TYPE, referenceId: referredUserId },
    select: { id: true },
  });
  if (already) {
    await cacheDel(pendingKey(referredUserId)).catch(() => {});
    return;
  }

  await awardStars(
    referrerId,
    REFERRER_STARS_TYPE,
    `${user.displayName || 'Davet ettiğin kullanıcı'} ilk aksiyonunu yaptı`,
    referredUserId,
  ).catch(() => {});
  await cacheDel(pendingKey(referredUserId)).catch(() => {});
}

module.exports = { markPendingReferral, maybeAwardReferrer, pendingKey, PENDING_TTL };
