const prisma = require('./prisma');

const STAR_AMOUNTS = {
  REVIEW: 5,
  RECOMMENDATION: 3,
  FRIEND_ADDED: 1,
  RATING: 2,
};

/**
 * Kullanıcıya yıldız kazandırır.
 * - star_events tablosuna kayıt ekler
 * - users.star_count'u atomik olarak artırır
 * - Yeni ödül açıldıysa user_rewards'a ekler
 *
 * @returns {{ event: StarEvent, newRewards: Reward[] }}
 */
async function awardStars(userId, type, description, referenceId = null, multiplier = 1) {
  const baseAmount = STAR_AMOUNTS[type];
  if (!baseAmount) throw new Error(`Unknown star event type: ${type}`);
  const amount = Math.round(baseAmount * multiplier);

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

module.exports = { awardStars, getLevel, STAR_AMOUNTS, STAR_LEVEL_DISCOUNTS };
