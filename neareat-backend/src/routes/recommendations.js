const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDinnerTonight, getDinnerTonightStream, postFeedback } = require('../controllers/recommendationController');

router.post('/dinner-tonight', authenticate, getDinnerTonight);
router.post('/dinner-tonight/stream', authenticate, getDinnerTonightStream);
router.post('/feedback', authenticate, postFeedback);

module.exports = router;
