'use strict';

// /api/place-requests — kullanıcıların eksik mekan talepleri (oluştur + kendi taleplerini gör).
// Admin tarafı listeleme/inceleme rotaları admin router'ında yer alır.
const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/placeRequestController');

router.use(auth); // Tüm uçlar giriş gerektirir

router.post('/', ctrl.submitRequest);
router.get('/my', ctrl.myRequests);

module.exports = router;
