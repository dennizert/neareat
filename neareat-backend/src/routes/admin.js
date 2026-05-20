const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');
const {
  adminLogin, getPendingRestaurants, getRestaurantDetail, getTaxCertificate,
  approveRestaurant, rejectRestaurant, getPlatformStats,
  getUsers, suspendUser, unsuspendUser,
  deleteReview, getFlaggedReviews, seedAdmin,
  getReports, handleReport,
} = require('../controllers/adminController');

// One-time seed — ADMIN_SEED_SECRET env var ile korunur
router.post('/seed', (req, res, next) => {
  const secret = process.env.ADMIN_SEED_SECRET;
  if (!secret) {
    logSecurityEvent(EVENTS.SEED_BLOCKED, {
      ip: req.ip,
      requestId: req.id,
      reason: 'ADMIN_SEED_SECRET env var tanımlı değil',
    });
    return res.status(503).json({ error: 'Seed devre dışı' });
  }
  if (req.headers['x-seed-secret'] !== secret) {
    logSecurityEvent(EVENTS.SEED_BLOCKED, {
      ip: req.ip,
      requestId: req.id,
      reason: 'Geçersiz seed secret',
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, seedAdmin);

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
