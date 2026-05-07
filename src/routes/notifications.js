const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { updateFcmToken, updatePreferences } = require('../controllers/notificationController');

router.put('/token', authenticate, updateFcmToken);
router.put('/preferences', authenticate, updatePreferences);

module.exports = router;
