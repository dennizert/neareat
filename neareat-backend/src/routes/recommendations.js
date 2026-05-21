const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDinnerTonight, getDinnerTonightStream, getRouteTonightRecommendation, postFeedback } = require('../controllers/recommendationController');

router.post('/dinner-tonight', authenticate, getDinnerTonight);
router.post('/dinner-tonight/stream', authenticate, getDinnerTonightStream);
router.post('/route-tonight', authenticate, getRouteTonightRecommendation);
router.post('/feedback', authenticate, postFeedback);

module.exports = router;
