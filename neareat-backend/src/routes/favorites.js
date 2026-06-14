// /api/favorites — kullanıcının favori mekanları (listele/ekle/çıkar).
const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { listFavorites, addFavorite, removeFavorite } = require('../controllers/favoriteController');

router.get('/', authenticate, listFavorites);
router.post('/', authenticate, addFavorite);
router.delete('/:placeId', authenticate, removeFavorite);

module.exports = router;
