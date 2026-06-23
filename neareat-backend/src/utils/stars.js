const prisma = require('./prisma');
const { createNotification } = require('../services/notificationService');

// Level-up'ın ötesindeki yıldız kilometre taşları (level 5 = 100 yıldız)
const STAR_MILESTONES = [200, 500, 1000];

const STAR_AMOUNTS = {
  REVIEW: 5,
  RECOMMENDATION: 3,
  FRIEND_ADDED: 1,
  RATING: 2,
  RESERVATION: 10,
  RESERVATION_ATTENDED: 20,
  REFERRAL: 15,
  REFERRAL_BONUS: 10,
};

const RESERVATION_NO_SHOW_PENALTY = 10;

// Gamification çekirdeği: bir aksiyon (yorum, rezervasyon, referral vb.) için kullanıcıya
// yıldız ekler. Tek transaction'da StarEvent kaydı + starCount artışı yapar; ardından
// level-up, kilometre taşı ve yeni açılan ödül bildirimlerini tetikler. Premium 2x gibi
// çarpanlar `multiplier` ile uygulanır. Kullanıcı sadakatini ödül sistemine bağlayan ana giriş noktası.
async function awardStars(userId, type, description, referenceId = null, multiplier = 1) {
  const baseAmount = STAR_AMOUNTS[type];
  if (!baseAmount) throw new Error(`Unknown star event type: ${type}`);
  const amount = Math.round(baseAmount * multiplier);

  // Mevcut seviyeyi kaydet (level-up tespiti için)
  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { starCount: true } });
  const oldLevel = getLevel(currentUser.starCount).level;

  const [event, updatedUser] = await prisma.$transaction([
    prisma.starEvent.create({
      data: { userId, type, amount, description, referenceId: referenceId ?? null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { starCount: { increment: amount } },
      select: { starCount: true },
    }),
  ]);

  const newStarCount = updatedUser.starCount;
  const newLevel = getLevel(newStarCount);

  // Level-up bildirimi
  if (newLevel.level > oldLevel) {
    createNotification(
      userId,
      'LEVEL_UP',
      '🎉 Seviye Atladın!',
      `${newLevel.badge} seviyesine ulaştın! ${newLevel.badgeIcon}`,
      { newLevel: newLevel.level, badge: newLevel.badge, badgeIcon: newLevel.badgeIcon },
    ).catch(() => {});
  }

  // Kilometre taşı bildirimi (level 5 sonrası: 200, 500, 1000 yıldız)
  const crossedMilestone = STAR_MILESTONES.find(
    m => m > currentUser.starCount && m <= newStarCount,
  );
  if (crossedMilestone) {
    createNotification(
      userId,
      'STAR_MILESTONE',
      '⭐ Yıldız Kilometre Taşı!',
      `Harika! Toplam ${crossedMilestone} yıldıza ulaştın. Yeni ödüller seni bekliyor olabilir!`,
      { milestone: crossedMilestone, screen: 'Rewards' },
    ).catch(() => {});
  }

  // Yeni açılan ödülleri kontrol et
  const eligibleRewards = await prisma.reward.findMany({
    where: { requiredStars: { lte: newStarCount } },
  });

  const newRewards = [];
  for (const reward of eligibleRewards) {
    try {
      await prisma.userReward.create({
        data: { userId, rewardId: reward.id },
      });
      newRewards.push(reward);
    } catch {
      // @@unique ihlali → zaten açılmış, atla
    }
  }

  return { event, newStarCount, newRewards };
}

// Toplam yıldız sayısını kullanıcı seviyesine + rozete çevirir (5 kademe, eşikler sabit).
// Hem level-up tespitinde (awardStars) hem profil/rozet gösteriminde kullanılır.
// S18-1: eşikler büyütüldü (özellikler artık seviyeye bağlandığı için tırmanma daha anlamlı
// olsun + farming zorlaşsın): L1 0–49 · L2 50–99 · L3 100–149 · L4 150–249 · L5 250+.
function getLevel(stars) {
  if (stars >= 250) return { level: 5, badge: 'Gastronomi Efsanesi', badgeIcon: '👑' };
  if (stars >= 150) return { level: 4, badge: 'NearEat Elçisi',       badgeIcon: '⭐' };
  if (stars >= 100) return { level: 3, badge: 'Restoran Uzmanı',      badgeIcon: '🏆' };
  if (stars >= 50)  return { level: 2, badge: 'Gastronomi Meraklısı', badgeIcon: '🍽️' };
  return                    { level: 1, badge: 'Yeni Kaşif',           badgeIcon: '🌱' };
}

// S18-1: bir seviyenin alt yıldız eşiği (sezon sıfırlamada — S18-4 — ve "sonraki seviyeye
// kaç yıldız" hesabında kullanılır). 5 kademe sabittir.
const LEVEL_THRESHOLDS = { 1: 0, 2: 50, 3: 100, 4: 150, 5: 250 };

// Verilen seviyenin başlangıç (alt) yıldız eşiğini döndürür. Sınır dışı seviyeler clamp'lenir.
function thresholdForLevel(level) {
  const lvl = Math.min(5, Math.max(1, Math.round(level)));
  return LEVEL_THRESHOLDS[lvl];
}

// S18-4: 6-aylık sezon sıfırlamasında bir kullanıcının yeni sezonluk yıldızı.
// KARAR: herkes 2 SEVİYE DÜŞER, taban L2 → newLevel = max(2, currentLevel - 2);
// yeni starCount o seviyenin alt eşiğine set edilir. (L5→L3=100, L4/L3/L2/L1→L2=50.)
// Saf fonksiyon — sezon job'ı bunu birim test edilebilir tek-kaynak olarak kullanır.
function computeSeasonResetStars(currentStars) {
  const currentLevel = getLevel(currentStars).level;
  const newLevel = Math.max(2, currentLevel - 2);
  return thresholdForLevel(newLevel);
}

// Sistem tanımlı yıldız seviyesi → indirim oranı tablosu (restoran değiştiremez)
const STAR_LEVEL_DISCOUNTS = { 1: 0, 2: 10, 3: 15, 4: 20, 5: 25 };

// Yıldız düşürür (örn. rezervasyona gelmeme/no-show cezası). starCount 0'ın altına inmez;
// negatif amount'lu bir StarEvent ile iz bırakır (denetlenebilirlik için).
async function deductStars(userId, amount, description, referenceId = null) {
  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { starCount: true } });
  const newCount = Math.max(0, currentUser.starCount - amount);

  await prisma.$transaction([
    prisma.starEvent.create({
      data: { userId, type: 'RATING', amount: -amount, description, referenceId: referenceId ?? null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { starCount: newCount },
    }),
  ]);

  return newCount;
}

module.exports = { awardStars, deductStars, getLevel, thresholdForLevel, computeSeasonResetStars, LEVEL_THRESHOLDS, STAR_AMOUNTS, STAR_LEVEL_DISCOUNTS, RESERVATION_NO_SHOW_PENALTY };
