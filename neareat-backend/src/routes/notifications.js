// /api/notifications — push token kaydı, uygulama içi bildirim listesi/okundu işaretleme
// ve tür bazlı bildirim tercihleri (type-preferences) rotaları.
const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  updateFcmToken, updatePreferences,
  getNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../controllers/notificationController');
const prefsCtrl = require('../controllers/notificationPrefsController');

router.put('/token', authenticate, updateFcmToken);
router.put('/preferences', authenticate, updatePreferences);
router.get('/type-preferences', authenticate, prefsCtrl.getPreferences);
router.put('/type-preferences', authenticate, prefsCtrl.updatePreferences);
router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.put('/read-all', authenticate, markAllAsRead);
router.put('/:id/read', authenticate, markAsRead);

module.exports = router;
