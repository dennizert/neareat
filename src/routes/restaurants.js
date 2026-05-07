const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getNearby, getDetails } = require('../controllers/restaurantController');

router.get('/nearby', authenticate, getNearby);
router.get('/:placeId', authenticate, getDetails);

module.exports = router;
