const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  getMySearchHistory,
  clearMySearchHistory,
  deleteOneFromHistory,
} = require('../controllers/searchHistoryController');

// Sprint-6 #87 — kullanıcının kendi arama geçmişi
router.get('/', authenticate, getMySearchHistory);
router.delete('/', authenticate, clearMySearchHistory);          // KVKK toplu silme
router.delete('/:id', authenticate, deleteOneFromHistory);       // tek kayıt silme

module.exports = router;
