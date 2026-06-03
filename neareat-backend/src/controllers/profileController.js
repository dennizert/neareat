const prisma = require('../utils/prisma');
const { getLevel } = require('../utils/stars');
const { isActivePremium } = require('../utils/premiumCheck');
const { logRequest } = require('../services/logService');
const { containsOffensiveContent } = require('../utils/contentFilter');

function formatProfile(user, subscription = null) {
  const level = getLevel(user.starCount);
  return {
    id: user.id,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    bio: user.bio ?? '',
    city: user.city ?? '',
    favoriteCuisines: user.favoriteCuisines ?? [],
    isPublic: user.isPublic,
    starCount: user.starCount,
    // AI Recommender opt-in (Sprint-1 Task #9): user.shareWithFriendsRecommender
    // null/undefined ise false varsayılan (eski user record'ları için)
    shareWithFriendsRecommender: user.shareWithFriendsRecommender ?? false,
    isPremium: isActivePremium(subscription),
    ...level,
  };
}

// GET /api/profile/me
async function getMe(req, res, next) {
  try {
    const [user, subscription, friendCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true, displayName: true, photoUrl: true,
          bio: true, city: true, favoriteCuisines: true,
          isPublic: true, starCount: true,
          shareWithFriendsRecommender: true,
          _count: { select: { reviews: true, sentRecommendations: true } },
        },
      }),
      prisma.subscription.findUnique({ where: { userId: req.user.id } }),
      prisma.friendRequest.count({
        where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }], status: 'ACCEPTED' },
      }),
    ]);

    res.json({
      ...formatProfile(user, subscription),
      stats: {
        friends: friendCount,
        reviews: user._count.reviews,
        recommendations: user._count.sentRecommendations,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/profile/me
async function updateMe(req, res, next) {
  try {
    const {
      displayName, bio, city, favoriteCuisines, isPublic, photoUrl,
      shareWithFriendsRecommender,
    } = req.body;

    // Kullanıcılara gösterilen serbest metinler içerik filtresinden geçer (S11-11).
    if ((displayName !== undefined && containsOffensiveContent(displayName)) ||
        (bio !== undefined && bio && containsOffensiveContent(bio))) {
      return res.status(400).json({ error: 'İsim/biyografi uygunsuz içerik (hakaret, argo veya küfür) içeremez.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(displayName !== undefined && { displayName: displayName.trim().slice(0, 50) }),
        ...(bio !== undefined && { bio: bio.trim().slice(0, 200) }),
        ...(city !== undefined && { city: city.trim().slice(0, 50) }),
        ...(favoriteCuisines !== undefined && { favoriteCuisines }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
        ...(photoUrl !== undefined && { photoUrl }),
        // AI Recommender opt-in (Sprint-1 Task #9)
        ...(shareWithFriendsRecommender !== undefined && {
          shareWithFriendsRecommender: Boolean(shareWithFriendsRecommender),
        }),
      },
      select: {
        id: true, displayName: true, photoUrl: true,
        bio: true, city: true, favoriteCuisines: true,
        isPublic: true, starCount: true,
        shareWithFriendsRecommender: true,
      },
    });

    logRequest({ req, page: 'Profil', action: 'Profil güncelledi' }).catch(() => {});
    res.json(formatProfile(updated));
  } catch (err) {
    next(err);
  }
}

// GET /api/profile/:userId
async function getUser(req, res, next) {
  try {
    const { userId } = req.params;

    const [user, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, displayName: true, photoUrl: true,
          bio: true, city: true, favoriteCuisines: true,
          isPublic: true, starCount: true,
          shareWithFriendsRecommender: true,
        },
      }),
      prisma.subscription.findUnique({ where: { userId } }),
    ]);

    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Gizli profili yalnızca arkadaşlar görebilir
    if (!user.isPublic && user.id !== req.user.id) {
      const friendship = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: req.user.id, toUserId: userId },
            { fromUserId: userId, toUserId: req.user.id },
          ],
          status: 'ACCEPTED',
        },
      });
      if (!friendship) {
        return res.json({ ...formatProfile(user, subscription), hidden: true });
      }
    }

    res.json(formatProfile(user, subscription));
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, getUser };
