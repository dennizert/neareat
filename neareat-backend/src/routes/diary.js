const router = require('express').Router();
const authenticate = require('../middleware/auth');
const {
  addDiaryEntry,
  listDiaryEntries,
  deleteDiaryEntry,
  getDiaryStats,
} = require('../controllers/diaryController');

// Sprint-7 #93 — kişisel yemek günlüğü (gizli, sadece sahibe görünür)
router.post('/', authenticate, addDiaryEntry);
router.get('/', authenticate, listDiaryEntries);
router.get('/stats', authenticate, getDiaryStats);
router.delete('/:id', authenticate, deleteDiaryEntry);

module.exports = router;
