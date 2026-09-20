const express = require('express');
const router = express.Router();
const optionalAuthenticate = require('../middleware/optionalAuth');
const { postEvent } = require('../controllers/analyticsController');

// optionalAuthenticate: anonim/misafir kullanıcı da event üretebilmeli (ör. giriş
// öncesi onboarding funnel'ı) — authenticate kullanılsaydı token'sız/süresi dolmuş
// istekte 401 dönerdi ve mobil tarafta bu YANLIŞLIKLA global logout'u tetikleyebilirdi
// (services/api.ts response interceptor'ı 401'de oturumu kapatıyor). Analitik asla
// ana ürün akışını etkilememeli.
router.post('/events', optionalAuthenticate, postEvent);

module.exports = router;
