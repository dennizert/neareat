// /api/places — yer arama (serbest metin) + kişiselleştirilmiş keşif (Sprint-17 #366).
const router = require('express').Router();
const optionalAuthenticate = require('../middleware/optionalAuth');
const authenticate = require('../middleware/auth');
const { searchByText } = require('../controllers/restaurantController');
const { recordView, getRecentlyViewed, getPersonalized } = require('../controllers/discoveryController');

// Sprint-6 #82 — serbest metin / isim bazlı yer arama
// optionalAuthenticate: oturum açmamış kullanıcılar da arayabilsin
router.get('/search', optionalAuthenticate, searchByText);

// Sprint-17 #366 — kişiselleştirme (tümü oturum gerektirir)
router.get('/personalized', authenticate, getPersonalized);
router.get('/recently-viewed', authenticate, getRecentlyViewed);
router.post('/view', authenticate, recordView);

module.exports = router;
