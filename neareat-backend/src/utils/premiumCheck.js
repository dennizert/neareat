const prisma = require('./prisma');

const PREMIUM_STATUSES = ['active', 'trial'];

function isActivePremium(subscription) {
  return (
    !!subscription &&
    PREMIUM_STATUSES.includes(subscription.status) &&
    new Date(subscription.expiresAt) > new Date()
  );
}

async function isPremiumUser(userId) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return isActivePremium(sub);
}

module.exports = { isPremiumUser, isActivePremium, PREMIUM_STATUSES };
