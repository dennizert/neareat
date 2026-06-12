const router = require('express').Router();
const authenticate = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');
const { getReviews, createReview, updateReview, deleteReview } = require('../controllers/reviewController');

router.get('/:placeId', authenticate, getReviews);
router.post('/', authenticate, requireVerifiedEmail, userRateLimit, createReview);
router.put('/:reviewId', authenticate, userRateLimit, updateReview);
router.delete('/:reviewId', authenticate, userRateLimit, deleteReview);

module.exports = router;
