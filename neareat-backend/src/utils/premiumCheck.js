const prisma = require('./prisma');

const PREMIUM_STATUSES = ['active', 'trial'];

// Her zaman premium sayılan e-postalar (env ile genişletilebilir; virgülle ayrılmış).
// Varsayılan: proje sahibi hesabı.
const ALWAYS_PREMIUM_EMAILS = (process.env.ALWAYS_PREMIUM_EMAILS || 'denniz.ertekin@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAlwaysPremiumEmail(email) {
  return !!email && ALWAYS_PREMIUM_EMAILS.includes(String(email).trim().toLowerCase());
}

function isActivePremium(subscription) {
  return (
    !!subscription &&
    PREMIUM_STATUSES.includes(subscription.status) &&
    new Date(subscription.expiresAt) > new Date()
  );
}

async function isPremiumUser(userId) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (isActivePremium(sub)) return true;

  // Allowlist override — aktif abonelik yoksa e-postaya bak
  if (ALWAYS_PREMIUM_EMAILS.length) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user && isAlwaysPremiumEmail(user.email)) return true;
  }
  return false;
}

module.exports = {
  isPremiumUser,
  isActivePremium,
  isAlwaysPremiumEmail,
  PREMIUM_STATUSES,
  ALWAYS_PREMIUM_EMAILS,
};
