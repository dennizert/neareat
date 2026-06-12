const prisma = require('../utils/prisma');
const { isActivePremium } = require('../utils/premiumCheck');

// Route'u yalnızca aktif premium aboneliği olan kullanıcılara açan koruma middleware'i.
// Premium değilse 403 + standart `PREMIUM_REQUIRED` kodu döner (mobil bu kodu yakalayıp
// PaywallScreen'e yönlendirir). Geçenlerde req.isPremium=true işaretler.
async function requirePremium(req, res, next) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });

  if (!isActivePremium(subscription)) {
    return res.status(403).json({ error: 'Premium subscription required', code: 'PREMIUM_REQUIRED' });
  }

  req.isPremium = true;
  next();
}

module.exports = requirePremium;
