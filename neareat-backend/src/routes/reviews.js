const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getReviews, createReview, updateReview, deleteReview } = require('../controllers/reviewController');

router.get('/:placeId', authenticate, getReviews);
router.post('/', authenticate, createReview);
router.put('/:reviewId', authenticate, updateReview);
router.delete('/:reviewId', authenticate, deleteReview);

module.exports = router;
