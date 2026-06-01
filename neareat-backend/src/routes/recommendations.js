const router = require('express').Router();
const authenticate = require('../middleware/auth');
const aiRateLimit = require('../middleware/aiRateLimit');
const { getDinnerTonight, getDinnerTonightStream, getRouteTonightRecommendation, postFeedback, analyzePhoto } = require('../controllers/recommendationController');

// Pahalı (Anthropic) uçlara ek sıkı kullanıcı bazlı limit. /feedback hafiftir, muaf.
router.post('/dinner-tonight', authenticate, aiRateLimit, getDinnerTonight);
router.post('/dinner-tonight/stream', authenticate, aiRateLimit, getDinnerTonightStream);
router.post('/route-tonight', authenticate, aiRateLimit, getRouteTonightRecommendation);
router.post('/feedback', authenticate, postFeedback);
router.post('/analyze-photo', authenticate, aiRateLimit, analyzePhoto);

module.exports = router;
