const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRestaurant } = require('../middleware/roles');
const {
  createReservation,
  getMyReservations,
  cancelReservation,
  updateReservation,
  getReservationDetail,
  getRestaurantReservations,
  updateReservationStatus,
  markAttendance,
  sendMessage,
  getMessages,
} = require('../controllers/reservationController');

// Kullanıcı — rezervasyon oluştur / listele
router.post('/', authenticate, createReservation);
router.get('/me', authenticate, getMyReservations);
router.put('/:id', authenticate, updateReservation);
router.delete('/:id', authenticate, cancelReservation);

// Restoran — rezervasyon listesi ve yönetimi
router.get('/restaurant', authenticate, requireRestaurant, getRestaurantReservations);
router.put('/:id/status', authenticate, requireRestaurant, updateReservationStatus);
router.put('/:id/attendance', authenticate, requireRestaurant, markAttendance);

// Ortak — detay ve mesajlaşma
router.get('/:id', authenticate, getReservationDetail);
router.post('/:id/messages', authenticate, sendMessage);
router.get('/:id/messages', authenticate, getMessages);

module.exports = router;
