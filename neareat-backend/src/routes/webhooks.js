const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { handleGooglePlayRTDN, getLastRtdn } = require('../controllers/subscriptionController');

// Google Cloud Pub/Sub push subscription — JWT auth gerektirmez; isteğin kendisi
// Pub/Sub OIDC token'ı ile doğrulanır (GOOGLE_PUBSUB_AUDIENCE, bkz. S12-4).
router.post('/google-play', handleGooglePlayRTDN);

// Teşhis: son alınan RTDN bildiriminin özeti. Hassas veri içermese de (token/kullanıcı yok)
// packageName/tip/sayaç gibi recon bilgisi sızdırmamak için admin auth arkasında (S13-2).
router.get('/google-play/last', authenticate, requireAdmin, getLastRtdn);

module.exports = router;
