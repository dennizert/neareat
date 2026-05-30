'use strict';

const prisma = require('../utils/prisma');
const { awardStars } = require('../utils/stars');
const { logRequest } = require('../services/logService');

const REFERRER_STARS = 15;
const REFERRED_STARS = 10;

// Davet eden için kod üretir: adın ilk 4 harfi (büyük, sadece A-Z) + 4 rasgele alfanümerik
function generateCode(displayName) {
  const prefix = (displayName || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}

async function ensureUniqueCode(displayName) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode(displayName);
    const existing = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error('Unique referral code üretilemedi');
}

// GET /api/referral/my-code
async function getMyCode(req, res, next) {
  try {
    const userId = req.user.id;

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, displayName: true, starCount: true },
    });

    if (!user.referralCode) {
      const code = await ensureUniqueCode(user.displayName);
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true, displayName: true, starCount: true },
      });
    }

    // Kaç kişi bu kodu kullandı
    const usageCount = await prisma.user.count({
      where: { referralApplied: true, starEvents: { some: { type: 'REFERRAL', referenceId: userId } } },
    });

    res.json({
      code: user.referralCode,
      usageCount,
      earnedStars: usageCount * REFERRER_STARS,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/referral/apply
// Body: { code }
async function applyCode(req, res, next) {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Referans kodu zorunlu.' });
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralApplied: true, referralCode: true, displayName: true },
    });

    if (me.referralApplied) {
      return res.status(409).json({ error: 'Referans kodunu zaten kullandınız.' });
    }

    const normalizedCode = code.trim().toUpperCase();

    if (me.referralCode && normalizedCode === me.referralCode) {
      return res.status(400).json({ error: 'Kendi referans kodunuzu kullanamazsınız.' });
    }

    const referrer = await prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true, displayName: true },
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Geçersiz referans kodu.' });
    }

    if (referrer.id === userId) {
      return res.status(400).json({ error: 'Kendi referans kodunuzu kullanamazsınız.' });
    }

    // Kodu kullanan olarak işaretle
    await prisma.user.update({
      where: { id: userId },
      data: { referralApplied: true },
    });

    // Ödüller (hata olursa işareti geri al)
    try {
      await Promise.all([
        awardStars(referrer.id, 'REFERRAL', `${me.displayName} davet kodunu kullandı`, userId),
        awardStars(userId, 'REFERRAL', `${referrer.displayName}'in davet kodu ile katıldın`, referrer.id),
      ]);
    } catch (starErr) {
      // Star hatası kritik değil, flag zaten set edildi
      console.error('[referral] star award error:', starErr.message);
    }

    logRequest({ req, page: 'Referral', action: 'Davet kodu uyguladı', details: normalizedCode }).catch(() => {});

    res.json({
      message: 'Davet kodu uygulandı.',
      earnedStars: REFERRED_STARS,
      referrerName: referrer.displayName,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyCode, applyCode };
