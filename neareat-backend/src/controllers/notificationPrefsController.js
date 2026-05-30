'use strict';

const prisma = require('../utils/prisma');

// Kullanıcıların toggle edebileceği bildirim türleri (kampanya/seviye vb. dahil)
const CONFIGURABLE_TYPES = [
  'FRIEND_REQUEST',
  'FRIEND_SUGGESTION',
  'RECOMMENDATION',
  'REVIEW_REPLY',
  'MEAL_GROUP_INVITE',
  'MEAL_GROUP_POLL',
  'MEAL_GROUP_POLL_CLOSED',
  'INSTANT_DISCOUNT',
  'RESERVATION_CONFIRMED',
  'RESERVATION_REJECTED',
  'RESERVATION_REMINDER',
  'WEEKLY_DIGEST',
  'INACTIVITY_REMINDER',
];

// GET /api/notifications/preferences
async function getPreferences(req, res, next) {
  try {
    const userId = req.user.id;

    const existing = await prisma.notificationPreference.findMany({
      where: { userId },
      select: { type: true, enabled: true },
    });

    const prefMap = Object.fromEntries(existing.map(p => [p.type, p.enabled]));

    // Kayıt yoksa varsayılan true (opt-out modeli)
    const preferences = CONFIGURABLE_TYPES.map(type => ({
      type,
      enabled: prefMap[type] ?? true,
    }));

    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/preferences
// Body: { preferences: [{ type, enabled }] }
async function updatePreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'preferences dizi olmalı.' });
    }

    const valid = preferences.filter(
      p => CONFIGURABLE_TYPES.includes(p.type) && typeof p.enabled === 'boolean',
    );

    if (valid.length === 0) {
      return res.status(400).json({ error: 'Geçerli tercih bulunamadı.' });
    }

    await Promise.all(valid.map(({ type, enabled }) =>
      prisma.notificationPreference.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, enabled },
        update: { enabled },
      }),
    ));

    res.json({ updated: valid.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPreferences, updatePreferences, CONFIGURABLE_TYPES };
