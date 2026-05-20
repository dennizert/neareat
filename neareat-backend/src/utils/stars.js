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
};

const RESERVATION_NO_SHOW_PENALTY = 10;

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

function getLevel(stars) {
  if (stars >= 100) return { level: 5, badge: 'Gastronomi Efsanesi', badgeIcon: '👑' };
  if (stars >= 50)  return { level: 4, badge: 'NearEat Elçisi',       badgeIcon: '⭐' };
  if (stars >= 25)  return { level: 3, badge: 'Restoran Uzmanı',      badgeIcon: '🏆' };
  if (stars >= 10)  return { level: 2, badge: 'Gastronomi Meraklısı', badgeIcon: '🍽️' };
  return                   { level: 1, badge: 'Yeni Kaşif',           badgeIcon: '🌱' };
}

// Sistem tanımlı yıldız seviyesi → indirim oranı tablosu (restoran değiştiremez)
const STAR_LEVEL_DISCOUNTS = { 1: 0, 2: 10, 3: 15, 4: 20, 5: 25 };

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

module.exports = { awardStars, deductStars, getLevel, STAR_AMOUNTS, STAR_LEVEL_DISCOUNTS, RESERVATION_NO_SHOW_PENALTY };
