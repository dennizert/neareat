/**
 * Admin uçları — İNCE controller (S23-3).
 *
 * S22-1 konvansiyonu: yalnızca HTTP çevirisi. İş kuralları `services/adminService` içinde.
 *
 * YETKİLENDİRME BURADA YOK ve olmamalı: `requireAdmin` middleware'i route seviyesinde
 * (`routes/admin.js`) uygulanır. Bu, korumanın uç noktaya bağlı kalmasını garanti eder —
 * servisi doğrudan çağıran bir yol açılsa bile HTTP yüzeyi korumasız kalmaz.
 *
 * Denetim izi (`logRequest`) burada kalır: isteği ve onu yapan admini kaydeder.
 */

const svc = require('../services/adminService');
const { sendHttpError } = require('../utils/httpError');
const { logRequest } = require('../services/logService');

// ─── Auth ────────────────────────────────────────────────────────────────────

async function adminLogin(req, res, next) {
  try {
    // IP ve requestId güvenlik logu + brute-force anahtarı için servise taşınır.
    res.json(await svc.adminLogin(req.body, { ip: req.ip, requestId: req.id }));
  } catch (err) { sendHttpError(res, err, next); }
}

async function seedAdmin(req, res, next) {
  try {
    res.status(201).json(await svc.seedAdmin(req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Restoran başvuruları ────────────────────────────────────────────────────

async function getPendingRestaurants(req, res, next) {
  try {
    res.json(await svc.getPendingRestaurants(req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getRestaurantDetail(req, res, next) {
  try {
    res.json(await svc.getRestaurantDetail(req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getTaxCertificate(req, res, next) {
  try {
    res.json(await svc.getTaxCertificate(req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function approveRestaurant(req, res, next) {
  try {
    const profile = await svc.approveRestaurant(req.user.id, req.params.id);
    logRequest({ req, page: 'Admin - Restoran Onayları', action: 'Restoran onayladı', details: profile.businessName }).catch(() => {});
    res.json(profile);
  } catch (err) { sendHttpError(res, err, next); }
}

async function rejectRestaurant(req, res, next) {
  try {
    const profile = await svc.rejectRestaurant(req.user.id, req.params.id, req.body);
    logRequest({ req, page: 'Admin - Restoran Onayları', action: 'Restoran reddetti', details: `${profile.businessName} — ${req.body.rejectionReason.trim()}` }).catch(() => {});
    res.json(profile);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Platform istatistikleri ─────────────────────────────────────────────────

async function getPlatformStats(req, res, next) {
  try {
    res.json(await svc.getPlatformStats());
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Kullanıcı yönetimi ──────────────────────────────────────────────────────

async function getUsers(req, res, next) {
  try {
    res.json(await svc.getUsers(req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

async function suspendUser(req, res, next) {
  try {
    const user = await svc.suspendUser(req.user.id, req.params.id);
    logRequest({ req, page: 'Admin - Kullanıcılar', action: 'Kullanıcı askıya aldı', details: `${user.displayName} (${user.email})` }).catch(() => {});
    res.json(user);
  } catch (err) { sendHttpError(res, err, next); }
}

async function unsuspendUser(req, res, next) {
  try {
    const user = await svc.unsuspendUser(req.params.id);
    logRequest({ req, page: 'Admin - Kullanıcılar', action: 'Kullanıcı askıyı kaldırdı', details: `${user.displayName} (${user.email})` }).catch(() => {});
    res.json(user);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Yorum moderasyonu ───────────────────────────────────────────────────────

async function deleteReview(req, res, next) {
  try {
    const { review, body } = await svc.deleteReview(req.params.id);
    logRequest({ req, page: 'Admin - Yorumlar', action: 'Yorum sildi', details: `placeId: ${review.placeId}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function getFlaggedReviews(req, res, next) {
  try {
    res.json(await svc.getFlaggedReviews());
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Kullanıcı şikayetleri ───────────────────────────────────────────────────

async function getReports(req, res, next) {
  try {
    res.json(await svc.getReports(req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

async function handleReport(req, res, next) {
  try {
    const { report, body } = await svc.handleReport(req.params.id, req.body);
    logRequest({ req, page: 'Admin - Şikayetler', action: 'Şikayet işledi', details: `${req.body.action} — ${report.reported.displayName}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Manuel job tetikleyicileri ──────────────────────────────────────────────

async function triggerFriendSuggestions(req, res, next) {
  try {
    const { result, body } = await svc.triggerFriendSuggestions();
    logRequest({ req, page: 'Admin Paneli', action: 'Arkadaş önerisi job tetikledi', details: `stored=${result.stored}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function triggerSeasonReset(req, res, next) {
  try {
    const { result, body } = await svc.triggerSeasonReset();
    logRequest({ req, page: 'Admin Paneli', action: 'Sezon sıfırlama job tetikledi', details: `action=${result.action}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function triggerNotificationCleanup(req, res, next) {
  try {
    const { deleted, body } = await svc.triggerNotificationCleanup();
    logRequest({ req, page: 'Admin Paneli', action: 'Bildirim temizlik job tetikledi', details: `deleted=${deleted}` }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Metrikler ───────────────────────────────────────────────────────────────

async function getMetrics(req, res, next) {
  try {
    res.json(await svc.getMetrics());
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = {
  adminLogin, getPendingRestaurants, getRestaurantDetail, getTaxCertificate,
  approveRestaurant, rejectRestaurant, getPlatformStats,
  getUsers, suspendUser, unsuspendUser,
  deleteReview, getFlaggedReviews, seedAdmin,
  getReports, handleReport,
  triggerFriendSuggestions, triggerNotificationCleanup, triggerSeasonReset,
  getMetrics,
};
