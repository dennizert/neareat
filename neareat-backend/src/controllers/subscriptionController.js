const prisma = require('../utils/prisma');
const { isAlwaysPremiumEmail, isActivePremium } = require('../utils/premiumCheck');
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7');

async function getSubscription(req, res, next) {
  try {
    let subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    // Güvenlik ağı: RTDN henüz gelmemişse expired'ı düzelt
    if (subscription?.status === 'active' && new Date(subscription.expiresAt) < new Date()) {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });
    }

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

// Google Play satın alma doğrulama — Android IAP akışı:
// 1. Mobil react-native-iap ile satın alma başlatır
// 2. Play Store onaylar → purchaseToken + productId gelir
// 3. Bu endpoint Google Play Developer API ile doğrular
// 4. Geçerliyse DB'de subscription aktifleştirir
async function verifyAndroidPurchase(req, res, next) {
  try {
    const { purchaseToken, productId } = req.body;
    if (!purchaseToken || !productId) {
      return res.status(400).json({ error: 'purchaseToken ve productId gerekli' });
    }

    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;

    if (!serviceAccountJson || !packageName) {
      return res.status(503).json({ error: 'Google Play entegrasyonu henüz yapılandırılmadı' });
    }

    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountJson),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidpublisher = google.androidpublisher({ version: 'v3', auth });
    const { data: purchase } = await androidpublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const expiryMs = parseInt(purchase.expiryTimeMillis, 10);
    if (!expiryMs || expiryMs < Date.now()) {
      return res.status(400).json({ error: 'Satın alma geçersiz veya süresi dolmuş' });
    }

    const planType = productId.includes('yearly') ? 'yearly' : 'monthly';

    const subscription = await prisma.subscription.upsert({
      where: { userId: req.user.id },
      update: {
        planType,
        status: 'active',
        expiresAt: new Date(expiryMs),
        storeTransactionId: purchaseToken,
      },
      create: {
        userId: req.user.id,
        planType,
        status: 'active',
        startedAt: new Date(),
        expiresAt: new Date(expiryMs),
        storeTransactionId: purchaseToken,
      },
    });

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

// iOS App Store doğrulama — gelecek sprintte eklenecek.
// Şimdilik client'ın gönderdiği expiresAt'e güveniyor (geçici).
async function verifyAppStorePurchase(req, res, next) {
  try {
    const { transactionId, planType, expiresAt } = req.body;
    if (!transactionId || !planType || !expiresAt) {
      return res.status(400).json({ error: 'transactionId, planType, expiresAt gerekli' });
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

// ─── Google Play Real-time Developer Notifications (RTDN) ────────────────────
// Google Cloud Pub/Sub push subscription bu endpoint'i çağırır.
// Bildirim türlerine göre DB'deki abonelik durumunu günceller.
// Pub/Sub'un yeniden deneme (retry) mekanizmasını tetiklememek için
// geçici hatalar dahil HER ZAMAN 200 döndürülür.

async function handleGooglePlayRTDN(req, res) {
  try {
    const message = req.body?.message;
    if (!message?.data) return res.status(200).json({ received: true });

    let notification;
    try {
      notification = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
    } catch {
      return res.status(200).json({ received: true });
    }

    const { packageName, subscriptionNotification } = notification;

    const expectedPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    if (expectedPackage && packageName !== expectedPackage) {
      return res.status(200).json({ received: true });
    }

    if (!subscriptionNotification) return res.status(200).json({ received: true });

    const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;

    // 1=RECOVERED 2=RENEWED 4=PURCHASED 7=RESTARTED → Google Play'den güncel durum çek
    if ([1, 2, 4, 7].includes(notificationType)) {
      await _refreshFromPlay(purchaseToken, subscriptionId);
    }
    // 3=CANCELED → iptal edildi ama bitiş tarihine kadar hâlâ aktif
    else if (notificationType === 3) {
      await _setSubscriptionStatus(purchaseToken, 'cancelled');
    }
    // 5=ON_HOLD 6=GRACE_PERIOD → Play'den güncel expiresAt al
    else if ([5, 6].includes(notificationType)) {
      await _refreshFromPlay(purchaseToken, subscriptionId);
    }
    // 12=REVOKED 13=EXPIRED → hemen expired yap
    else if ([12, 13].includes(notificationType)) {
      await _setSubscriptionStatus(purchaseToken, 'expired');
    }
  } catch (err) {
    console.error('[RTDN] İşleme hatası:', err.message);
  }
  return res.status(200).json({ received: true });
}

async function _refreshFromPlay(purchaseToken, subscriptionId) {
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!serviceAccountJson || !packageName) return;

  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  const { data: purchase } = await androidpublisher.purchases.subscriptions.get({
    packageName,
    subscriptionId,
    token: purchaseToken,
  });

  const expiryMs = parseInt(purchase.expiryTimeMillis, 10);
  if (!expiryMs) return;

  const subscription = await prisma.subscription.findFirst({
    where: { storeTransactionId: purchaseToken },
  });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: expiryMs > Date.now() ? 'active' : 'expired',
      expiresAt: new Date(expiryMs),
    },
  });
}

async function _setSubscriptionStatus(purchaseToken, status) {
  const subscription = await prisma.subscription.findFirst({
    where: { storeTransactionId: purchaseToken },
  });
  if (!subscription) return;
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status },
  });
}

module.exports = {
  getSubscription,
  startTrial,
  verifyAndroidPurchase,
  verifyAppStorePurchase,
  handleGooglePlayRTDN,
};
