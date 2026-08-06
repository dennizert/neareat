/**
 * Restoran hesabı uçları — İNCE controller (S22-1).
 *
 * Sorumluluk yalnızca HTTP çevirisi: girdiyi `req`'ten oku, servisi çağır, sonucu
 * statü + JSON olarak yaz. İş kuralı ve veri erişimi `services/restaurantAccountService`
 * içindedir; oradaki fonksiyonlar `req`/`res` bilmez ve bağımsız test edilebilir.
 *
 * Hata sözleşmesi: servis BEKLENEN iş hatalarını `HttpError` ile bildirir, `sendHttpError`
 * gövdeyi aynen yazar (statü kodları ve `code` alanları birebir korunur). Beklenmeyen
 * hatalar `next(err)` ile merkezi errorHandler'a gider ve 5xx olarak loglanır/Sentry'ye iletilir.
 */

const svc = require('../services/restaurantAccountService');
const { sendHttpError } = require('../utils/httpError');
const { logRequest } = require('../services/logService');

async function registerRestaurant(req, res, next) {
  try {
    const { user, response } = await svc.registerRestaurant(req.body);
    logRequest({ req: { ...req, user }, page: 'Restoran Kaydı', action: 'Restoran kaydı oluşturdu', details: req.body.businessName }).catch(() => {});
    res.status(201).json(response);
  } catch (err) { sendHttpError(res, err, next); }
}

async function getMyProfile(req, res, next) {
  try {
    res.json(await svc.getMyProfile(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function updateHours(req, res, next) {
  try {
    res.json(await svc.updateHours(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function uploadMenuItem(req, res, next) {
  try {
    res.status(201).json(await svc.uploadMenuItem(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getMenuItemData(req, res, next) {
  try {
    res.json(await svc.getMenuItemData(req.params.itemId));
  } catch (err) { sendHttpError(res, err, next); }
}

async function deleteMenuItem(req, res, next) {
  try {
    res.json(await svc.deleteMenuItem(req.user.id, req.params.itemId));
  } catch (err) { sendHttpError(res, err, next); }
}

async function replyToReview(req, res, next) {
  try {
    const reply = await svc.replyToReview(req.user.id, req.params.reviewId, req.body);
    logRequest({ req, page: 'Restoran Paneli', action: 'Yoruma cevap verdi', details: req.params.reviewId }).catch(() => {});
    res.json(reply);
  } catch (err) { sendHttpError(res, err, next); }
}

async function deleteReply(req, res, next) {
  try {
    res.json(await svc.deleteReply(req.user.id, req.params.reviewId));
  } catch (err) { sendHttpError(res, err, next); }
}

async function updateDiscount(req, res, next) {
  try {
    res.json(await svc.updateDiscount(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function activateInstantDiscount(req, res, next) {
  try {
    res.json(await svc.activateInstantDiscount(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function deactivateInstantDiscount(req, res, next) {
  try {
    res.json(await svc.deactivateInstantDiscount(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function updateAnnouncement(req, res, next) {
  try {
    res.json(await svc.updateAnnouncement(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function updateInfo(req, res, next) {
  try {
    const profile = await svc.updateInfo(req.user.id, req.body);
    logRequest({ req, page: 'Restoran Paneli', action: 'İletişim bilgilerini güncelledi' }).catch(() => {});
    res.json(profile);
  } catch (err) { sendHttpError(res, err, next); }
}

async function getStats(req, res, next) {
  try {
    res.json(await svc.getStats(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getMyReviews(req, res, next) {
  try {
    res.json(await svc.getMyReviews(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getAnalytics(req, res, next) {
  try {
    res.json(await svc.getAnalytics(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getOccupancy(req, res, next) {
  try {
    res.json(await svc.getOccupancy(req.user.id, req.query.date));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getWeeklyReport(req, res, next) {
  try {
    res.json(await svc.getWeeklyReport(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function sendCampaign(req, res, next) {
  try {
    const result = await svc.sendCampaign(req.user.id, req.body || {});
    logRequest({ req, page: 'Restoran Paneli', action: 'Kampanya gönderdi', details: `${result.sent} kişi` }).catch(() => {});
    res.status(201).json(result);
  } catch (err) { sendHttpError(res, err, next); }
}

async function createPhotoUploadUrl(req, res, next) {
  try {
    res.json(await svc.createPhotoUploadUrl(req.user.id, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

async function addPhoto(req, res, next) {
  try {
    res.status(201).json(await svc.addPhoto(req.user.id, req.body || {}));
  } catch (err) { sendHttpError(res, err, next); }
}

async function listPhotos(req, res, next) {
  try {
    res.json(await svc.listPhotos(req.user.id, req.query.kind));
  } catch (err) { sendHttpError(res, err, next); }
}

async function deletePhoto(req, res, next) {
  try {
    res.json(await svc.deletePhoto(req.user.id, req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = {
  registerRestaurant, getMyProfile, updateHours,
  uploadMenuItem, getMenuItemData, deleteMenuItem,
  replyToReview, deleteReply,
  updateDiscount, activateInstantDiscount, deactivateInstantDiscount,
  updateAnnouncement, updateInfo, getStats, getMyReviews,
  sendCampaign, getAnalytics, getWeeklyReport, getOccupancy,
  createPhotoUploadUrl, addPhoto, listPhotos, deletePhoto,
};
