const router = require('express').Router();
const authenticate = require('../middleware/auth');
const optionalAuthenticate = require('../middleware/optionalAuth');
const { getNearby, getDetails } = require('../controllers/restaurantController');

// optionalAuthenticate: unauthenticated callers get free-tier radius (registration flow)
router.get('/nearby', optionalAuthenticate, getNearby);
router.get('/:placeId', authenticate, getDetails);

module.exports = router;
