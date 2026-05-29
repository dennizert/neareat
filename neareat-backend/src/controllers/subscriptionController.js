const prisma = require('../utils/prisma');
const { isAlwaysPremiumEmail, isActivePremium } = require('../utils/premiumCheck');
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7');

async function getSubscription(req, res, next) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    // Allowlist override — aktif aboneliği olmayan "her zaman premium" hesaplar için
    // sentetik premium abonelik döndür (mobil UI premium gösterir).
    if (!isActivePremium(subscription) && isAlwaysPremiumEmail(req.user.email)) {
      return res.json({
        id: 'always-premium',
        userId: req.user.id,
        planType: 'yearly',
        status: 'active',
        startedAt: new Date('2020-01-01').toISOString(),
        expiresAt: new Date('2099-12-31').toISOString(),
      });
    }

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

async function startTrial(req, res, next) {
  try {
    const existing = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    if (existing) {
      return res.status(400).json({ error: 'User already has a subscription' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.id,
        planType: 'trial',
        status: 'trial',
        startedAt: now,
        expiresAt,
      },
    });

    res.status(201).json(subscription);
  } catch (err) {
    next(err);
  }
}

async function createCheckout(req, res, next) {
  try {
    const { planType } = req.body;
    if (!['monthly', 'yearly'].includes(planType)) {
      return res.status(400).json({ error: 'planType must be monthly or yearly' });
    }
    res.json({ message: 'Checkout session created', planType });
  } catch (err) {
    next(err);
  }
}

async function iyzicoWebhook(req, res, next) {
  try {
    const { subscriptionReferenceCode, status } = req.body;

    if (!subscriptionReferenceCode || !status) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { iyzicoSubscriptionId: subscriptionReferenceCode },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: status === 'ACTIVE' ? 'active' : 'cancelled' },
      });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function verifyAppStorePurchase(req, res, next) {
  try {
    const { transactionId, planType, expiresAt } = req.body;
    if (!transactionId || !planType || !expiresAt) {
      return res.status(400).json({ error: 'transactionId, planType, expiresAt required' });
    }

    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user.id },
      update: {
        planType,
        status: 'active',
        expiresAt: new Date(expiresAt),
        storeTransactionId: transactionId,
      },
      create: {
        userId: req.user.id,
        planType,
        status: 'active',
        startedAt: new Date(),
        expiresAt: new Date(expiresAt),
        storeTransactionId: transactionId,
      },
    });

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSubscription, startTrial, createCheckout, iyzicoWebhook, verifyAppStorePurchase };
