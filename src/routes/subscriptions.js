const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  getSubscription,
  startTrial,
  createCheckout,
  iyzicoWebhook,
  verifyAppStorePurchase,
} = require('../controllers/subscriptionController');

router.get('/', authenticate, getSubscription);
router.post('/trial', authenticate, startTrial);
router.post('/checkout', authenticate, createCheckout);
router.post('/webhook/iyzico', iyzicoWebhook);
router.post('/verify/appstore', authenticate, verifyAppStorePurchase);

module.exports = router;
