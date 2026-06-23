const prisma = require('../utils/prisma');
const { getUserAccess } = require('../utils/levelAccess');
const { logActivity, ACTIVITY_TYPES } = require('../services/logService');

// Kullanıcının favorilerini listeler; kayıtlı (APPROVED) restoranların görünen adıyla
// zenginleştirir (kart "displayName || placeName" gösterir). Restoran kendi adını
// güncellediğinde favori kartı da güncel görünsün diye.
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

// Favori ekler. Free kullanıcıda limiti (FREE_FAVORITES_LIMIT) zorlar → aşılırsa 403
// PREMIUM_REQUIRED. upsert ile çift eklemeyi engeller; yalnızca İLK eklemede sosyal
// aktivite olayı yazar (tekrar eklemede spam üretmez).
async function addFavorite(req, res, next) {
  try {
    const { placeId, placeName, placeAddress, placeLat, placeLng, placePhone, placePhotoUrl, placeRating } = req.body;

    if (!placeId || !placeName || placeLat == null || placeLng == null) {
      return res.status(400).json({ error: 'placeId, placeName, placeLat, placeLng required' });
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      select: { id: true },
    });

    // S18-2: Favori limiti yıldız SEVİYESİNE bağlı (premium kaldırıldı): L1=5, L2=15,
    // L3=30, L4=50, L5=sınırsız. Limit yalnızca YENİ favoride uygulanır (idempotent
    // yeniden ekleme — örn. optimistik toggle — limite takılmaz).
    if (!existing) {
      const { level, access } = await getUserAccess(req.user.id);
      const favLimit = access.favoritesLimit; // number | null (null = sınırsız)
      if (favLimit !== null) {
        const count = await prisma.favorite.count({ where: { userId: req.user.id } });
        if (count >= favLimit) {
          return res.status(403).json({
            error: `Favori limitine ulaştın (${favLimit}). Daha fazla favori için seviye atla.`,
            code: 'LEVEL_REQUIRED', requiredLevel: Math.min(5, level + 1), feature: 'favorite',
          });
        }
      }
    }

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

// Favoriden çıkarır (placeId ile, yalnızca kendi kaydı). Yoksa hata değil — idempotent.
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
