const router = require('express').Router();
const optionalAuthenticate = require('../middleware/optionalAuth');
const { searchByText } = require('../controllers/restaurantController');

// Sprint-6 #82 — serbest metin / isim bazlı yer arama
// optionalAuthenticate: oturum açmamış kullanıcılar da arayabilsin
router.get('/search', optionalAuthenticate, searchByText);

module.exports = router;
