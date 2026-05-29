const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRestaurant } = require('../middleware/roles');
const {
  registerRestaurant, getMyProfile, updateHours,
  uploadMenuItem, getMenuItemData, deleteMenuItem,
  replyToReview, deleteReply,
  updateDiscount, activateInstantDiscount, deactivateInstantDiscount,
  updateAnnouncement, updateInfo, getStats, getMyReviews,
  sendCampaign,
} = require('../controllers/restaurantAccountController');

// Public — no auth
router.post('/register', registerRestaurant);

// Authenticated restaurant routes
router.get('/me', authenticate, requireRestaurant, getMyProfile);
router.put('/hours', authenticate, requireRestaurant, updateHours);
router.put('/info', authenticate, requireRestaurant, updateInfo);
router.put('/announcement', authenticate, requireRestaurant, updateAnnouncement);
router.get('/stats', authenticate, requireRestaurant, getStats);
router.get('/reviews', authenticate, requireRestaurant, getMyReviews);

// Menu
router.post('/menu', authenticate, requireRestaurant, uploadMenuItem);
router.delete('/menu/:itemId', authenticate, requireRestaurant, deleteMenuItem);

// Review replies
router.post('/reviews/:reviewId/reply', authenticate, requireRestaurant, replyToReview);
router.delete('/reviews/:reviewId/reply', authenticate, requireRestaurant, deleteReply);

// Discount
router.put('/discount', authenticate, requireRestaurant, updateDiscount);
router.post('/discount/activate', authenticate, requireRestaurant, activateInstantDiscount);
router.delete('/discount/deactivate', authenticate, requireRestaurant, deactivateInstantDiscount);

// Anlık kampanya gönderimi (S5-3) — günde 1
router.post('/campaign', authenticate, requireRestaurant, sendCampaign);

// Menu data (accessible to authenticated users for viewing)
router.get('/menu/:itemId/data', authenticate, getMenuItemData);

module.exports = router;
