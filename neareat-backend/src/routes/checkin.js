const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  createCheckin,
  getMyActiveCheckin,
  cancelMyCheckin,
} = require('../controllers/checkinController');

// Sprint-7 #91 — restorana check-in (3h TTL)
router.post('/', authenticate, createCheckin);
router.get('/me', authenticate, getMyActiveCheckin);
router.delete('/', authenticate, cancelMyCheckin);

module.exports = router;
