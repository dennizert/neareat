const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const {
  adminLogin, getPendingRestaurants, getRestaurantDetail, getTaxCertificate,
  approveRestaurant, rejectRestaurant, getPlatformStats,
  getUsers, suspendUser, unsuspendUser,
  deleteReview, getFlaggedReviews, seedAdmin,
  getReports, handleReport,
} = require('../controllers/adminController');

// One-time seed (no auth — only works if no admin exists)
router.post('/seed', seedAdmin);

// Admin login (no auth middleware — returns token)
router.post('/login', adminLogin);

// All routes below require admin role
router.get('/stats', authenticate, requireAdmin, getPlatformStats);

// Restaurant approval
router.get('/restaurants', authenticate, requireAdmin, getPendingRestaurants);
router.get('/restaurants/:id', authenticate, requireAdmin, getRestaurantDetail);
router.get('/restaurants/:id/certificate', authenticate, requireAdmin, getTaxCertificate);
router.post('/restaurants/:id/approve', authenticate, requireAdmin, approveRestaurant);
router.post('/restaurants/:id/reject', authenticate, requireAdmin, rejectRestaurant);

// User management
router.get('/users', authenticate, requireAdmin, getUsers);
router.post('/users/:id/suspend', authenticate, requireAdmin, suspendUser);
router.post('/users/:id/unsuspend', authenticate, requireAdmin, unsuspendUser);

// Review moderation
router.get('/reviews', authenticate, requireAdmin, getFlaggedReviews);
router.delete('/reviews/:id', authenticate, requireAdmin, deleteReview);

// User reports
router.get('/reports', authenticate, requireAdmin, getReports);
router.put('/reports/:id', authenticate, requireAdmin, handleReport);

module.exports = router;
