const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { getDinnerTonight } = require('../controllers/recommendationController');

router.post('/dinner-tonight', authenticate, getDinnerTonight);

module.exports = router;
