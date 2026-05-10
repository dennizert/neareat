const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  updateFcmToken, updatePreferences,
  getNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../controllers/notificationController');

router.put('/token', authenticate, updateFcmToken);
router.put('/preferences', authenticate, updatePreferences);
router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.put('/read-all', authenticate, markAllAsRead);
router.put('/:id/read', authenticate, markAsRead);

module.exports = router;
