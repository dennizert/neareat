const router = require('express').Router();
const { handleGooglePlayRTDN } = require('../controllers/subscriptionController');

// Google Cloud Pub/Sub push subscription — kimlik doğrulama gerektirmez.
// Google, istekleri Pub/Sub service account OIDC token'ı ile imzalar;
// tam doğrulama için GOOGLE_PUBSUB_AUDIENCE env var ile genişletilebilir.
router.post('/google-play', handleGooglePlayRTDN);

module.exports = router;
