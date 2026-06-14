// /api/meal-groups — yemek grupları ve restoran anketleri rotaları (giriş + rate limit zorunlu).
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userRateLimit = require('../middleware/userRateLimit');
const ctrl = require('../controllers/mealGroupController');

router.use(auth);
router.use(userRateLimit);

router.get('/', ctrl.getMyGroups);
router.post('/', ctrl.createGroup);
router.get('/:id', ctrl.getGroup);
router.post('/:id/respond', ctrl.respondToInvite);
router.post('/:id/members', ctrl.addMembers);
router.post('/:id/polls', ctrl.createPoll);
router.post('/:id/quick-poll', ctrl.quickPoll);
router.post('/:groupId/polls/:pollId/vote', ctrl.vote);
router.post('/:groupId/polls/:pollId/close', ctrl.closePoll);

module.exports = router;
