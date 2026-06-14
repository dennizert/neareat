// /api/profile — kendi profilini görüntüle/güncelle ve başka kullanıcıların profilini gör.
const router = require('express').Router();
const auth = require('../middleware/auth');
const { getMe, updateMe, getUser } = require('../controllers/profileController');

router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);
router.get('/:userId', auth, getUser);

module.exports = router;
