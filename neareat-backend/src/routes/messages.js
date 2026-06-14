// /api/messages — kullanıcılar arası birebir mesajlaşma rotaları.
// Mesaj gönderimi e-posta doğrulaması + rate limit gerektirir.
const router = require('express').Router();
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');

router.get('/unread-count', auth, getUnreadCount);
router.get('/conversations', auth, getConversations);
router.get('/:userId', auth, getMessages);
router.post('/:userId', auth, requireVerifiedEmail, userRateLimit, sendMessage);

module.exports = router;
