// Hafif ürün analitiği — mobil sink'in yazdığı funnel event'leri (bkz. services/analyticsService.js).
const svc = require('../services/analyticsService');
const { sendHttpError } = require('../utils/httpError');

// POST /api/analytics/events — optionalAuth kullanır: giriş yapmış kullanıcıda
// userId ekleniyor, anonim/misafirde de event kaydediliyor. Asla 401/403 ile
// akışı kesmez; ölçüm asla ana ürün deneyimini bozmamalı.
async function postEvent(req, res, next) {
  try {
    await svc.recordEvent({
      userId: req.user?.id ?? null,
      name: req.body?.name,
      props: req.body?.props,
    });
    res.status(202).json({ received: true });
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/admin/analytics/summary — son N gün için event adına göre sayım.
async function getSummary(req, res, next) {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    res.json(await svc.getFunnelSummary({ days }));
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = { postEvent, getSummary };
