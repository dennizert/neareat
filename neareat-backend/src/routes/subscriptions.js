// /api/subscriptions — abonelik durumu ve IAP satın alma doğrulama
// (Android Google Play / App Store) rotaları.
const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  getSubscription,
  startTrialRemoved,
  verifyAndroidPurchase,
  verifyAppStorePurchase,
} = require('../controllers/subscriptionController');

router.get('/', authenticate, getSubscription);
// S18: self-service deneme kaldırıldı — eski istemciler için 410 döner (bkz. controller).
router.post('/trial', authenticate, startTrialRemoved);
router.post('/verify/android', authenticate, verifyAndroidPurchase);
router.post('/verify/appstore', authenticate, verifyAppStorePurchase);

module.exports = router;
