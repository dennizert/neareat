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
async function awardStars(userId, type, description, referenceId = null) {
  const amount = STAR_AMOUNTS[type];
  if (!amount) throw new Error(`Unknown star event type: ${type}`);

  const [event, updatedUser] = await prisma.$transaction([
    prisma.starEvent.create({
      data: { userId, type, amount, description, referenceId },
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

module.exports = { awardStars, getLevel, STAR_AMOUNTS };
