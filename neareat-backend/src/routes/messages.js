const router = require('express').Router();
const auth = require('../middleware/auth');
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');

router.get('/unread-count', auth, getUnreadCount);
router.get('/conversations', auth, getConversations);
router.get('/:userId', auth, getMessages);
router.post('/:userId', auth, sendMessage);

module.exports = router;
