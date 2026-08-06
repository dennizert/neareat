/**
 * Rezervasyon uçları — İNCE controller (S23-1).
 *
 * S22-1 konvansiyonu: yalnızca HTTP çevirisi. İş kuralları `services/reservationService`
 * içinde; zamana bağlı saf kurallar (ay çapası, girdi doğrulaması, iptal politikası)
 * `utils/reservationPolicy` içinde ve doğrudan birim testli.
 *
 * `computeCancelPolicy` buradan YENİDEN EXPORT edilir: mevcut birim testi onu bu modülden
 * import ediyor. Uygulaması util'e taşındı, dışa açılan yüzey korundu.
 */

const svc = require('../services/reservationService');
const { sendHttpError } = require('../utils/httpError');
const { logRequest } = require('../services/logService');
const { computeCancelPolicy } = require('../utils/reservationPolicy');

// GET /api/reservations/availability
async function getAvailability(req, res, next) {
  try {
    res.json(await svc.getAvailability(req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/reservations
async function createReservation(req, res, next) {
  try {
    const reservation = await svc.createReservation(req.user, req.body);
    const { date, time, guestCount } = req.body;
    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon oluşturdu', details: `${reservation.placeName} — ${date} ${time}, ${guestCount} kişi` }).catch(() => {});
    res.status(201).json(reservation);
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/reservations/me
async function getMyReservations(req, res, next) {
  try {
    res.json(await svc.getMyReservations(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

// DELETE /api/reservations/:id
async function cancelReservation(req, res, next) {
  try {
    const { reservation, body } = await svc.cancelReservation(req.user, req.params.id);
    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon iptal etti', details: `${reservation.placeName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

// PUT /api/reservations/:id
async function updateReservation(req, res, next) {
  try {
    const { old, reservation } = await svc.updateReservation(req.user, req.params.id, req.body);
    const { date, time, guestCount } = req.body;
    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon güncelledi', details: `${old.placeName} — ${date} ${time}, ${guestCount} kişi` }).catch(() => {});
    res.status(201).json(reservation);
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/reservations/:id
async function getReservationDetail(req, res, next) {
  try {
    res.json(await svc.getReservationDetail(req.user.id, req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/reservations/restaurant
async function getRestaurantReservations(req, res, next) {
  try {
    res.json(await svc.getRestaurantReservations(req.user.id, req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

// PUT /api/reservations/:id/status
async function updateReservationStatus(req, res, next) {
  try {
    const { reservation, updated } = await svc.updateReservationStatus(req.user.id, req.params.id, req.body);
    const logAction = req.body.status === 'CONFIRMED' ? 'Rezervasyon onayladı' : 'Rezervasyon reddetti';
    logRequest({ req, page: 'Restoran Paneli', action: logAction, details: `${reservation.placeName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json(updated);
  } catch (err) { sendHttpError(res, err, next); }
}

// PUT /api/reservations/:id/attendance
async function markAttendance(req, res, next) {
  try {
    const { profile, reservation, updated } = await svc.markAttendance(req.user.id, req.params.id, req.body);
    const attendanceLog = req.body.attended
      ? 'Rezervasyon katılımını işaretledi (geldi)'
      : 'Rezervasyon katılımını işaretledi (gelmedi)';
    logRequest({ req, page: 'Restoran Paneli', action: attendanceLog, details: `${profile.businessName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json(updated);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/reservations/:id/messages
async function sendMessage(req, res, next) {
  try {
    res.status(201).json(await svc.sendMessage(req.user, req.params.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/reservations/:id/messages
async function getMessages(req, res, next) {
  try {
    res.json(await svc.getMessages(req.user.id, req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = {
  createReservation,
  getAvailability,
  getMyReservations,
  cancelReservation,
  computeCancelPolicy, // geriye uyum: mevcut birim testi bu modülden import ediyor
  updateReservation,
  getReservationDetail,
  getRestaurantReservations,
  updateReservationStatus,
  markAttendance,
  sendMessage,
  getMessages,
};
