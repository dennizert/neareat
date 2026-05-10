const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  searchUsers,
  getFriends, getPendingRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  sendRecommendation, getMyRecommendations, getReceivedRecommendations, getUserRecommendations,
  getStarEvents,
  getRewards,
  rateRestaurant,
  getLeaderboard,
  getFriendSuggestions,
  reportUser,
} = require('../controllers/socialController');

// Kullanıcı arama
router.get('/users/search', auth, searchUsers);

// Arkadaş sistemi
router.get('/friends', auth, getFriends);
router.get('/friends/requests', auth, getPendingRequests);
router.post('/friends/requests', auth, sendFriendRequest);
router.post('/friends/requests/:id/accept', auth, acceptFriendRequest);
router.post('/friends/requests/:id/reject', auth, rejectFriendRequest);
router.delete('/friends/:id', auth, removeFriend);

// Öneriler
router.post('/recommendations', auth, sendRecommendation);
router.get('/recommendations/mine', auth, getMyRecommendations);
router.get('/recommendations/received', auth, getReceivedRecommendations);
router.get('/recommendations/user/:userId', auth, getUserRecommendations);

// Yıldız geçmişi
router.get('/stars', auth, getStarEvents);

// Ödüller
router.get('/rewards', auth, getRewards);

// Anlık puanlama
router.post('/stars/rating', auth, rateRestaurant);

// Liderlik listesi
router.get('/leaderboard', auth, getLeaderboard);

// Arkadaş önerileri
router.get('/friend-suggestions', auth, getFriendSuggestions);

// Kullanıcı şikayet
router.post('/users/:userId/report', auth, reportUser);

module.exports = router;
