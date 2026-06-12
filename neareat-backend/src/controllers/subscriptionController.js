const prisma = require('../utils/prisma');
const { isAlwaysPremiumEmail, isActivePremium } = require('../utils/premiumCheck');
const { cacheGet, cacheSet } = require('../services/redis');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');
const { verifyPubSubPush } = require('../services/pubsubAuth');
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7');

// RTDN teşhisi: gelen her bildirimin özetini (token/kullanıcı YOK) Redis'e yazar.
// GET /webhooks/google-play/last ile son bildirimi okumak için (kurulum doğrulaması).
async function recordRtdnReceipt(notification) {
  try {
    const {
      packageName, subscriptionNotification, testNotification,
      voidedPurchaseNotification, oneTimeProductNotification,
    } = notification || {};
    let type = 'unknown';
    if (testNotification) type = 'test';
    else if (subscriptionNotification) type = `subscription:${subscriptionNotification.notificationType}`;
    else if (voidedPurchaseNotification) type = 'voided';
    else if (oneTimeProductNotification) type = 'oneTimeProduct';

    const prev = await cacheGet('rtdn:last');
    await cacheSet('rtdn:last', {
      at: new Date().toISOString(),
      type,
      packageName: packageName || null,
      count: ((prev && prev.count) || 0) + 1,
    }, 30 * 24 * 60 * 60);
  } catch {
    // Teşhis amaçlı — webhook akışını asla bozma.
  }
}

// GET /webhooks/google-play/last — son alınan RTDN bildiriminin özeti.
// Hassas veri içermez (satın alma token'ı / kullanıcı yok); kurulum doğrulaması için açık.
async function getLastRtdn(req, res) {
  const last = await cacheGet('rtdn:last');
  res.json({ last: last || null });
}

// Kullanıcının abonelik durumunu döner. RTDN gecikirse süresi geçmiş "active" kaydı
// expired'a düzeltir (güvenlik ağı) ve doğrulanmış allowlist hesaplarına sentetik premium
// abonelik döndürür (mobil UI premium göstersin diye).
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
    // S13-4: yalnızca doğrulanmış (emailVerified) hesaplar için.
    if (!isActivePremium(subscription) && req.user.emailVerified && isAlwaysPremiumEmail(req.user.email)) {
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

// Ücretsiz deneme aboneliği başlatır (TRIAL_DAYS gün). Kullanıcının daha önce herhangi bir
// aboneliği varsa reddeder → deneme yalnızca bir kez kullanılabilir.
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

    // S12-3: Token bir hesaba bağlanır — yeniden kullanımı/paylaşımı engelle.
    // (a) Token başka bir kullanıcının aboneliğine bağlıysa reddet.
    const existingForToken = await prisma.subscription.findFirst({
      where: { storeTransactionId: purchaseToken },
    });
    if (existingForToken && existingForToken.userId !== req.user.id) {
      logSecurityEvent(EVENTS.IAP_REJECTED, {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        reason: 'purchase_token_reuse',
      });
      return res.status(409).json({
        error: 'PURCHASE_TOKEN_ALREADY_USED',
        message: 'Bu satın alma başka bir hesapta kullanılmış.',
      });
    }
    // (b) Satın alma Google tarafında bir hesaba bağlandıysa (obfuscatedExternalAccountId),
    //     istek sahibiyle eşleşmeli. Eşleşmezse paylaşılmış token demektir.
    if (purchase.obfuscatedExternalAccountId &&
        purchase.obfuscatedExternalAccountId !== req.user.id) {
      logSecurityEvent(EVENTS.IAP_REJECTED, {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        reason: 'purchase_account_mismatch',
      });
      return res.status(409).json({
        error: 'PURCHASE_ACCOUNT_MISMATCH',
        message: 'Bu satın alma farklı bir hesaba ait.',
      });
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

    // S12-3: Google, doğrulanmış aboneliği ~3 günde otomatik iade etmesin diye
    // acknowledge et (best-effort — hata doğrulamayı bozmaz).
    if (purchase.acknowledgementState === 0) {
      try {
        await androidpublisher.purchases.subscriptions.acknowledge({
          packageName,
          subscriptionId: productId,
          token: purchaseToken,
        });
      } catch (ackErr) {
        console.error('[IAP] acknowledge başarısız:', ackErr.message);
      }
    }

    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

// iOS App Store doğrulama.
//
// GÜVENLİK (S12-1): Bu uç ASLA istemcinin gönderdiği expiresAt/planType/transactionId'ye
// güvenerek premium aktifleştirmez — aksi halde herhangi bir kullanıcı sahte bir bitiş
// tarihi göndererek kendine ömür boyu premium verebilirdi (kritik yetki yükseltme).
//
// Gerçek doğrulama (Apple App Store Server API ile StoreKit 2 JWS imza doğrulaması)
// iOS lansman task'ında implemente edilecek. O zamana kadar uç FAIL-CLOSED:
//   - IOS_IAP_ENABLED !== 'true'  → 503, DB'ye yazma yok.
//   - IOS_IAP_ENABLED === 'true'  → 501 (doğrulama henüz implemente edilmedi), DB'ye yazma yok.
async function verifyAppStorePurchase(req, res) {
  const { transactionId, planType, expiresAt } = req.body || {};
  if (!transactionId || !planType || !expiresAt) {
    return res.status(400).json({ error: 'transactionId, planType, expiresAt gerekli' });
  }

  logSecurityEvent(EVENTS.IAP_REJECTED, {
    userId: req.user.id,
    ip: req.ip,
    path: req.path,
    requestId: req.id,
    reason: 'appstore_client_trust_disabled',
  });

  if (process.env.IOS_IAP_ENABLED !== 'true') {
    return res.status(503).json({
      error: 'IOS_IAP_NOT_CONFIGURED',
      message: 'iOS satın alma doğrulaması henüz aktif değil.',
    });
  }

  // Env açık olsa bile sunucu-taraflı imza doğrulaması hazır olana kadar premium AÇMA.
  return res.status(501).json({
    error: 'IOS_IAP_VERIFICATION_NOT_IMPLEMENTED',
    message: 'iOS satın alma doğrulaması henüz tamamlanmadı.',
  });
}

// ─── Google Play Real-time Developer Notifications (RTDN) ────────────────────
// Google Cloud Pub/Sub push subscription bu endpoint'i çağırır.
// Bildirim türlerine göre DB'deki abonelik durumunu günceller.
// Pub/Sub'un yeniden deneme (retry) mekanizmasını tetiklememek için
// geçici hatalar dahil HER ZAMAN 200 döndürülür.

async function handleGooglePlayRTDN(req, res) {
  try {
    // S12-4: Pub/Sub authenticated push doğrulaması. Yapılandırıldığında yalnızca
    // Google imzalı bildirimler işlenir; sahte istekler reddedilir (sahte iptal / DoS engeli).
    const auth = await verifyPubSubPush(req);
    if (!auth.ok) {
      logSecurityEvent(EVENTS.AUTH_FAILED, {
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        reason: `pubsub_${auth.reason}`,
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!auth.enforced) {
      console.warn('[RTDN][warn] GOOGLE_PUBSUB_AUDIENCE tanımlı değil — webhook doğrulanmıyor (üretimde ayarlayın).');
    }

    const message = req.body?.message;
    if (!message?.data) return res.status(200).json({ received: true });

    let notification;
    try {
      notification = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
    } catch {
      return res.status(200).json({ received: true });
    }

    const { packageName, subscriptionNotification } = notification;

    // Teşhis: gelen her bildirimi (test dahil) kaydet — fire-and-forget.
    recordRtdnReceipt(notification).catch(() => {});

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

// RTDN yardımcısı: Google Play'den aboneliğin GÜNCEL durumunu çekip DB'yi senkronize eder
// (yenileme/geri kazanım bildirimlerinde). Token'la eşleşen abonelik yoksa sessizce çıkar.
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

// RTDN yardımcısı: token'la eşleşen aboneliğin durumunu doğrudan ayarlar (iptal/expired/revoked
// bildirimlerinde — Play'e ekstra sorgu atmadan).
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
  getLastRtdn,
};
