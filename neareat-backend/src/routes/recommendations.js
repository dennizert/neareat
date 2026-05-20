const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDinnerTonight, postFeedback } = require('../controllers/recommendationController');

router.post('/dinner-tonight', authenticate, getDinnerTonight);
router.post('/feedback', authenticate, postFeedback);

module.exports = router;
