// IAP purchase ledger yazıcı (S14-B4).
//
// Neden: Abonelik durumu tek satırda tutuluyor; iade/çift-token/RTDN olayları için iz yok.
// Bu helper her doğrulama/RTDN olayını append-only `PurchaseEvent`'e yazar — suistimal
// tespiti, muhasebe ve destek için. Token HAM saklanmaz (hash'lenir).
//
// Best-effort: asıl IAP akışını ASLA bozmaz (hata yutulur).
const prisma = require('../utils/prisma');
const logger = require('../utils/logger'); // S21-2
const { hashToken } = require('../utils/tokenHash');

/**
 * @param {object} e
 * @param {string} [e.userId]
 * @param {'android'|'appstore'|'rtdn'} e.source
 * @param {string} e.type        olay/bildirim türü
 * @param {string} [e.productId]
 * @param {string} [e.purchaseToken] ham token (DB'ye hash'li yazılır)
 * @param {string} e.status      verified | reuse_rejected | account_mismatch | blocked | renewed | expired | cancelled ...
 * @param {object} [e.rawPayload]
 */
async function recordPurchaseEvent(e) {
  try {
    await prisma.purchaseEvent.create({
      data: {
        userId: e.userId ?? null,
        source: e.source,
        type: e.type,
        productId: e.productId ?? null,
        tokenHash: e.purchaseToken ? hashToken(e.purchaseToken) : null,
        status: e.status,
        rawPayload: e.rawPayload ?? null,
      },
    });
  } catch (err) {
    logger.warn('[purchaseLedger] yazım başarısız', { error: err.message });
  }
}

module.exports = { recordPurchaseEvent };
