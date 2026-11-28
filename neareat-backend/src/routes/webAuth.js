// /api/auth/web — web paneli çerez oturumu (issue #524 / #525). `/api/auth` altında bağlandığı
// için `authLimiter` (20 istek / 15 dk) ve 10 kb gövde sınırını app.js'ten miras alır.
const router = require('express').Router();
const validate = require('../middleware/validate');
const { requireWebOrigin, requireWebSession } = require('../middleware/webSession');
const { loginEmailSchema, webGoogleLoginSchema } = require('../validation/schemas');
const {
  webLogin, webGoogleLogin, getWebSession, webLogout, webLogoutAll,
} = require('../controllers/webAuthController');

// Oturum öncesi: CSRF token'ı yok, Origin kontrolü var (login CSRF'e karşı).
router.post('/login', requireWebOrigin, validate(loginEmailSchema), webLogin);
router.post('/google', requireWebOrigin, validate(webGoogleLoginSchema), webGoogleLogin);

router.get('/session', requireWebSession, getWebSession);
router.post('/logout', webLogout); // Origin + CSRF, geçerli oturum varsa controller'da
router.post('/logout-all', requireWebSession, webLogoutAll);

module.exports = router;
