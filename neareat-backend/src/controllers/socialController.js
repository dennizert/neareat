/**
 * Sosyal uçlar — İNCE controller (S22-2).
 *
 * S22-1 konvansiyonu: yalnızca HTTP çevirisi. İş kuralı ve veri erişimi
 * `services/socialService` içindedir; gizlilik kuralları (isim maskeleme, profil
 * görünürlüğü) `utils/socialPrivacy` içinde saf ve birim testlidir.
 *
 * Bazı uçlar işlemi yapanın `displayName`/`starCount` alanlarına ihtiyaç duyar
 * (bildirim metni, liderlik sıralaması) — servise `actor` nesnesi olarak geçilir.
 */

const svc = require('../services/socialService');
const { sendHttpError } = require('../utils/httpError');
const { logRequest } = require('../services/logService');

// GET /api/social/users/search?q=
async function searchUsers(req, res, next) {
  try {
    res.json(await svc.searchUsers(req.user.id, req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Arkadaş sistemi ─────────────────────────────────────────────────────────

async function getFriends(req, res, next) {
  try {
    res.json(await svc.getFriends(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getPendingRequests(req, res, next) {
  try {
    res.json(await svc.getPendingRequests(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function sendFriendRequest(req, res, next) {
  try {
    const { status, body, autoAccepted } = await svc.sendFriendRequest(req.user, req.body);
    logRequest({
      req,
      page: 'Arkadaşlar',
      action: autoAccepted
        ? 'Arkadaşlık isteği gönderdi (karşılıklı — otomatik kabul)'
        : 'Arkadaşlık isteği gönderdi',
      details: req.body.toUserId,
    }).catch(() => {});
    res.status(status).json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function acceptFriendRequest(req, res, next) {
  try {
    const { fromUserId, body } = await svc.acceptFriendRequest(req.user.id, req.params.id);
    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği kabul etti', details: fromUserId }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function rejectFriendRequest(req, res, next) {
  try {
    const { fromUserId, body } = await svc.rejectFriendRequest(req.user.id, req.params.id);
    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği reddetti', details: fromUserId }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

async function removeFriend(req, res, next) {
  try {
    const { otherId, body } = await svc.removeFriend(req.user.id, req.params.id);
    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşı kaldırdı', details: otherId }).catch(() => {});
    res.json(body);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Öneriler ────────────────────────────────────────────────────────────────

async function sendRecommendation(req, res, next) {
  try {
    const result = await svc.sendRecommendation(req.user, req.body);
    logRequest({ req, page: 'Restoran', action: 'Restoran önerdi', details: req.body.placeName }).catch(() => {});
    res.status(201).json(result);
  } catch (err) { sendHttpError(res, err, next); }
}

async function getMyRecommendations(req, res, next) {
  try {
    res.json(await svc.getMyRecommendations(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getReceivedRecommendations(req, res, next) {
  try {
    res.json(await svc.getReceivedRecommendations(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getUserRecommendations(req, res, next) {
  try {
    res.json(await svc.getUserRecommendations(req.user.id, req.params.userId));
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Yıldız geçmişi & ödüller ────────────────────────────────────────────────

async function getStarEvents(req, res, next) {
  try {
    res.json(await svc.getStarEvents(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getRewards(req, res, next) {
  try {
    res.json(await svc.getRewards(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Anlık puanlama ──────────────────────────────────────────────────────────

async function rateRestaurant(req, res, next) {
  try {
    const result = await svc.rateRestaurant(req.user.id, req.body);
    logRequest({ req, page: 'Restoran', action: 'Restoran puanladı', details: req.body.placeName }).catch(() => {});
    res.status(201).json(result);
  } catch (err) { sendHttpError(res, err, next); }
}

// ─── Liderlik / öneriler / şikayet / akış ────────────────────────────────────

async function getLeaderboard(req, res, next) {
  try {
    res.json(await svc.getLeaderboard(req.user));
  } catch (err) { sendHttpError(res, err, next); }
}

async function getFriendSuggestions(req, res, next) {
  try {
    res.json(await svc.getFriendSuggestions(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

async function reportUser(req, res, next) {
  try {
    const result = await svc.reportUser(req.user.id, req.params.userId, req.body);
    logRequest({ req, page: 'Kullanıcı Profili', action: 'Kullanıcı şikayet etti', details: req.params.userId }).catch(() => {});
    res.status(201).json(result);
  } catch (err) { sendHttpError(res, err, next); }
}

async function getActivityFeed(req, res, next) {
  try {
    res.json(await svc.getActivityFeed(req.user.id, req.query));
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = {
  searchUsers,
  getActivityFeed,
  getFriends, getPendingRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  sendRecommendation, getMyRecommendations, getReceivedRecommendations, getUserRecommendations,
  getStarEvents,
  getRewards,
  rateRestaurant,
  getLeaderboard,
  getFriendSuggestions,
  reportUser,
};
