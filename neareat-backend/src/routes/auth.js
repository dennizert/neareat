const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  login, register, loginEmail, getMe, deleteAccount,
  verifyEmail, resendVerification, forgotPassword, resetPassword,
} = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
router.post('/login/email', loginEmail);
router.get('/me', authenticate, getMe);
router.delete('/account', authenticate, deleteAccount);

router.post('/verify-email', verifyEmail);
router.post('/resend-verification', authenticate, resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
