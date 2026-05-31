const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  getSubscription,
  startTrial,
  verifyAndroidPurchase,
  verifyAppStorePurchase,
} = require('../controllers/subscriptionController');

router.get('/', authenticate, getSubscription);
router.post('/trial', authenticate, startTrial);
router.post('/verify/android', authenticate, verifyAndroidPurchase);
router.post('/verify/appstore', authenticate, verifyAppStorePurchase);

module.exports = router;
