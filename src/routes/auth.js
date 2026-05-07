const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { login, register, loginEmail, getMe, deleteAccount } = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
router.post('/login/email', loginEmail);
router.get('/me', authenticate, getMe);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;
