'use strict';

// /api/referral — davet kodu görüntüleme ve uygulama rotaları (giriş + rate limit zorunlu).
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const ctrl = require('../controllers/referralController');

router.use(auth);
router.use(userRateLimit);

router.get('/my-code', ctrl.getMyCode);
router.post('/apply', ctrl.applyCode);

module.exports = router;
