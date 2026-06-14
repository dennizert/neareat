// /api/logs — admin kullanıcı aktivite logları sorgu rotası (yalnızca admin).
const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { getLogs } = require('../controllers/logController');

router.get('/', authenticate, requireAdmin, getLogs);

module.exports = router;
