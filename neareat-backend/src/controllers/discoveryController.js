'use strict';

/**
 * Kişiselleştirilmiş keşif controller'ı (Sprint-17 #366).
 *
 * - POST /api/places/view            → mekan görüntülemesini kaydeder (upsert)
 * - GET  /api/places/recently-viewed → son baktığı 10 mekan
 * - GET  /api/places/personalized    → damak profiline göre raylar + yeniden sıralı liste
 *
 * Skorlama/profil mantığı saf `personalizationService`'tedir; burada yalnızca DB sinyalleri
 * toplanır, nearby boru hattı (restaurantController.buildNearbyResults) yeniden kullanılır
 * ve sonuçlar birleştirilir. Sinyal yoksa boş section'larla 200 döner (mobil eskiye düşer).
 */

const prisma = require('../utils/prisma');
const { buildNearbyResults } = require('./restaurantController');
const { isPremiumUser } = require('../utils/premiumCheck');
const { getLevel } = require('../utils/stars');
const { deriveCuisineTags } = require('../utils/cuisineTags');
const { buildTasteProfile, rankForYou } = require('../services/personalizationService');

const FREE_RADIUS_KM = parseInt(process.env.FREE_RADIUS_KM || '5');
const PREMIUM_RADIUS_KM = parseInt(process.env.PREMIUM_RADIUS_KM || '25');

const RECENTLY_VIEWED_LIMIT = 10;
const FOR_YOU_LIMIT = 20;
const REVISIT_LIMIT = 10;
const TOP_CUISINES_LIMIT = 5;

// Decimal alanlarını güvenle JS number'a çevirir (Prisma Decimal | null).
function toNumber(d) {
  if (d === null || d === undefined) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

// PlaceView satırını "Son Baktıkların" rayının kart şekline çevirir.
function mapViewRow(v) {
  return {
    placeId: v.placeId,
    name: v.placeName,
    address: v.placeAddress,
    photoUrl: v.placePhotoUrl,
    rating: toNumber(v.placeRating),
    types: v.placeTypes || [],
    viewedAt: v.viewedAt,
  };
}

// POST /api/places/view — kullanıcı bir mekan detayını açtığında çağrılır.
// Aynı (userId, placeId) için tek satır tutulur; tekrar görüntülemede viewedAt yenilenir.
async function recordView(req, res, next) {
  try {
    const { placeId, placeName, placeAddress, placePhotoUrl, placeRating, placeTypes } = req.body;
    if (!placeId || !placeName) {
      return res.status(400).json({ error: 'placeId ve placeName zorunludur.' });
    }
    const data = {
      placeName,
      placeAddress: placeAddress || null,
      placePhotoUrl: placePhotoUrl || null,
      placeRating: placeRating != null ? placeRating : null,
      placeTypes: Array.isArray(placeTypes) ? placeTypes : [],
      viewedAt: new Date(),
    };
    await prisma.placeView.upsert({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      update: data,
      create: { userId: req.user.id, placeId, ...data },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/places/recently-viewed — son baktığı mekanlar (en yeni en başta).
async function getRecentlyViewed(req, res, next) {
  try {
    const views = await prisma.placeView.findMany({
      where: { userId: req.user.id },
      orderBy: { viewedAt: 'desc' },
      take: RECENTLY_VIEWED_LIMIT,
    });
    res.json({ recentlyViewed: views.map(mapViewRow) });
  } catch (err) {
    next(err);
  }
}

// GET /api/places/personalized?lat&lng — kişiselleştirilmiş Keşfet verisi.
async function getPersonalized(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat ve lng zorunludur.' });
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const userId = req.user.id;

    const premium = await isPremiumUser(userId);
    const radiusKm = premium ? PREMIUM_RADIUS_KM : FREE_RADIUS_KM;
    const userLevel = getLevel(req.user.starCount).level;

    // Aday liste (mevcut nearby boru hattı) + tüm davranış sinyallerini paralel topla.
    const [nearby, favorites, reviews, reservations, checkins, diary, recsSent, user, feedbackPref, recentViews] =
      await Promise.all([
        buildNearbyResults({ userLat, userLng, radiusKm, placeType: 'all', cuisineFilter: [], userLevel }),
        prisma.favorite.findMany({ where: { userId }, select: { placeId: true, placeName: true } }),
        prisma.review.findMany({ where: { userId }, select: { placeId: true, rating: true } }),
        prisma.reservation.findMany({ where: { userId }, select: { placeId: true, placeName: true } }),
        prisma.checkIn.findMany({ where: { userId }, select: { placeId: true, placeName: true } }),
        prisma.diaryEntry.findMany({ where: { userId }, select: { placeId: true, placeName: true, placeTypes: true } }),
        prisma.recommendation.findMany({ where: { fromUserId: userId }, select: { placeId: true, placeName: true, placeTypes: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { favoriteCuisines: true } }),
        prisma.feedbackPreference.findUnique({ where: { userId }, select: { likedTypes: true } }),
        prisma.placeView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: RECENTLY_VIEWED_LIMIT }),
      ]);

    // Etkileşilen mekanların mutfak etiketlerini ağırlık sınıfıyla derle.
    const weightedTags = [
      ...favorites.map((f) => ({ tags: deriveCuisineTags({ name: f.placeName }), weightKey: 'favoritePlaceTag' })),
      ...reservations.map((r) => ({ tags: deriveCuisineTags({ name: r.placeName }), weightKey: 'otherEngagedTag' })),
      ...checkins.map((c) => ({ tags: deriveCuisineTags({ name: c.placeName }), weightKey: 'otherEngagedTag' })),
      ...diary.map((d) => ({ tags: deriveCuisineTags({ name: d.placeName, types: d.placeTypes }), weightKey: 'otherEngagedTag' })),
      ...recsSent.map((r) => ({ tags: deriveCuisineTags({ name: r.placeName, types: r.placeTypes }), weightKey: 'otherEngagedTag' })),
    ];

    // "Denenmiş" + "yüksek puanlı" placeId kümeleri.
    const triedPlaceIds = [
      ...favorites, ...reviews, ...reservations, ...checkins, ...diary,
    ].map((x) => x.placeId);
    const highRatedPlaceIds = [
      ...reviews.filter((r) => r.rating >= 4).map((r) => r.placeId),
      ...favorites.map((f) => f.placeId),
    ];

    // Ziyaret sıklığı (rezervasyon + check-in + günlük) — "sık gittiğin yer" sinyali.
    const placeFrequency = {};
    for (const x of [...reservations, ...checkins, ...diary]) {
      placeFrequency[x.placeId] = (placeFrequency[x.placeId] || 0) + 1;
    }

    const profile = buildTasteProfile({
      favoriteCuisines: user?.favoriteCuisines || [],
      likedTypes: feedbackPref?.likedTypes || [],
      weightedTags,
      triedPlaceIds,
      highRatedPlaceIds,
      placeFrequency,
    });

    // "Senin İçin" — nearby'ı kişisel skora göre yeniden sırala.
    const forYou = rankForYou(nearby, profile).slice(0, FOR_YOU_LIMIT);

    // "Tekrar gitmek ister misin?" — yakındaki + daha önce gidilen + kapalı olmayan mekanlar.
    const triedSet = profile.triedPlaceIds;
    const revisit = nearby
      .filter((p) => triedSet.has(p.placeId) && p.isOpenNow !== false)
      .sort((a, b) => (placeFrequency[b.placeId] || 0) - (placeFrequency[a.placeId] || 0))
      .slice(0, REVISIT_LIMIT)
      .map((p) => ({ ...p, reasons: ['Tekrar gitmek ister misin?'] }));

    // En güçlü mutfak etiketleri (profil özeti).
    const topCuisines = [...profile.cuisineWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CUISINES_LIMIT)
      .map(([tag]) => tag);

    res.json({
      tasteProfile: { topCuisines },
      recentlyViewed: recentViews.map(mapViewRow),
      forYou,
      revisit,
      radiusKm,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordView, getRecentlyViewed, getPersonalized };
