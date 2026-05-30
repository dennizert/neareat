const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDinnerTonight, getDinnerTonightStream, getRouteTonightRecommendation, postFeedback, analyzePhoto } = require('../controllers/recommendationController');

router.post('/dinner-tonight', authenticate, getDinnerTonight);
router.post('/dinner-tonight/stream', authenticate, getDinnerTonightStream);
router.post('/route-tonight', authenticate, getRouteTonightRecommendation);
router.post('/feedback', authenticate, postFeedback);
router.post('/analyze-photo', authenticate, analyzePhoto);

module.exports = router;
