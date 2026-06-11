const prisma = require('../utils/prisma');
const { isPremiumUser } = require('../utils/premiumCheck');
const { logActivity, ACTIVITY_TYPES } = require('../services/logService');

// Ücretsiz favori limiti env'den okunur (.env.example: FREE_FAVORITES_LIMIT). Varsayılan 5.
const FREE_FAVORITES_LIMIT = parseInt(process.env.FREE_FAVORITES_LIMIT, 10) || 5;

async function listFavorites(req, res, next) {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // S10 — sahibin görünen adıyla zenginleştir (APPROVED profil, placeId eşleşmesi).
    // Kart "displayName || placeName" gösterir; profil yoksa Google adı (regresyon yok).
    const placeIds = favorites.map((f) => f.placeId);
    let nameMap = {};
    if (placeIds.length) {
      const profiles = (await prisma.restaurantProfile.findMany({
        where: { placeId: { in: placeIds }, status: 'APPROVED' },
        select: { placeId: true, displayName: true },
      })) || [];
      nameMap = Object.fromEntries(
        profiles.filter((p) => p.displayName).map((p) => [p.placeId, p.displayName]),
      );
    }
    const enriched = favorites.map((f) => ({ ...f, displayName: nameMap[f.placeId] ?? null }));
    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

async function addFavorite(req, res, next) {
  try {
    const { placeId, placeName, placeAddress, placeLat, placeLng, placePhone, placePhotoUrl, placeRating } = req.body;

    if (!placeId || !placeName || placeLat == null || placeLng == null) {
      return res.status(400).json({ error: 'placeId, placeName, placeLat, placeLng required' });
    }

    const [premium, count] = await Promise.all([
      isPremiumUser(req.user.id),
      prisma.favorite.count({ where: { userId: req.user.id } }),
    ]);
    if (!premium && count >= FREE_FAVORITES_LIMIT) {
      return res.status(403).json({ error: 'Favorite limit reached', code: 'PREMIUM_REQUIRED' });
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      select: { id: true },
    });

    const favorite = await prisma.favorite.upsert({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      update: {},
      create: { userId: req.user.id, placeId, placeName, placeAddress, placeLat, placeLng, placePhone, placePhotoUrl, placeRating },
    });

    // Sosyal aktivite akışı — yalnızca YENİ favori (tekrar eklemede event üretme)
    if (!existing) {
      logActivity({
        userId: req.user.id,
        type: ACTIVITY_TYPES.FAVORITE,
        placeId,
        metadata: { placeName: placeName || null },
      });
    }

    res.status(201).json(favorite);
  } catch (err) {
    next(err);
  }
}

async function removeFavorite(req, res, next) {
  try {
    const { placeId } = req.params;
    await prisma.favorite.deleteMany({ where: { userId: req.user.id, placeId } });
    res.json({ message: 'Removed' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listFavorites, addFavorite, removeFavorite };
