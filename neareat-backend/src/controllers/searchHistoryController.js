/**
 * Arama geçmişi kontrolcüsü (Sprint-6 #87).
 *
 * - logSearchHistory: arama yapıldığında fire-and-forget kayıt (boş/çok kısa
 *   sorgular kayıt dışı). Endpoint'ten doğrudan çağrılmaz, controller içinden
 *   await EDİLMEDEN kullanılır.
 * - getMySearchHistory: kullanıcının son aramaları.
 * - clearMySearchHistory: KVKK silme — kullanıcının tüm geçmişini siler.
 * - deleteOneFromHistory: tek bir kaydı siler (sahibi olmak şart).
 */

const prisma = require('../utils/prisma');

const MAX_HISTORY_RETURNED = 30;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

/**
 * Fire-and-forget: arama isteğinden tetiklenir. Hata sessizce yutulur — arama
 * akışını engellememeli.
 */
function logSearchHistory(userId, query, type = 'free_text') {
  if (!userId) return; // anonim aramalar kaydedilmez
  const q = String(query || '').trim();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return;
  prisma.searchHistory
    .create({ data: { userId, query: q, type } })
    .catch((err) => console.warn('[searchHistory] log failed:', err.message));
}

// Kullanıcının son aramalarını döner (en yeni önce, üst sınır MAX_HISTORY_RETURNED).
async function getMySearchHistory(req, res, next) {
  try {
    const items = await prisma.searchHistory.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_RETURNED,
      select: { id: true, query: true, type: true, createdAt: true },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// KVKK: kullanıcının TÜM arama geçmişini siler (profil → "geçmişi temizle").
async function clearMySearchHistory(req, res, next) {
  try {
    const { count } = await prisma.searchHistory.deleteMany({
      where: { userId: req.user.id },
    });
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
}

// Tek bir arama kaydını siler. Sahip kontrolü deleteMany'nin where'inde (id + userId) yapılır,
// böylece başkasının kaydı silinemez (IDOR koruması).
async function deleteOneFromHistory(req, res, next) {
  try {
    const { id } = req.params;
    // Yalnızca kendi kaydını silebilsin — deleteMany ile sahip kontrolü
    const { count } = await prisma.searchHistory.deleteMany({
      where: { id, userId: req.user.id },
    });
    if (count === 0) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  logSearchHistory,
  getMySearchHistory,
  clearMySearchHistory,
  deleteOneFromHistory,
  MAX_HISTORY_RETURNED,
};
