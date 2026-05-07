const prisma = require('../utils/prisma');
const { awardStars, getLevel } = require('../utils/stars');

// ─── Kullanıcı Arama ─────────────────────────────────────────────────────────

// GET /api/social/users/search?q=
async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    // Zaten arkadaş olan kullanıcıları hariç tut
    const existingRequests = await prisma.friendRequest.findMany({
      where: {
        OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
        status: 'ACCEPTED',
      },
      select: { fromUserId: true, toUserId: true },
    });
    const friendIds = existingRequests.flatMap(r =>
      [r.fromUserId, r.toUserId].filter(id => id !== req.user.id),
    );

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: [req.user.id, ...friendIds] },
        displayName: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true, displayName: true, photoUrl: true,
        bio: true, city: true, starCount: true, isPublic: true,
      },
      take: 20,
    });

    res.json(users.map(u => ({ ...u, ...getLevel(u.starCount) })));
  } catch (err) {
    next(err);
  }
}

// ─── Arkadaş Sistemi ─────────────────────────────────────────────────────────

// GET /api/social/friends
async function getFriends(req, res, next) {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
        status: 'ACCEPTED',
      },
      include: {
        fromUser: { select: { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true, isPublic: true } },
        toUser:   { select: { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true, isPublic: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const friends = requests.map(r => {
      const friend = r.fromUserId === req.user.id ? r.toUser : r.fromUser;
      return {
        id: r.id,
        profile: { ...friend, ...getLevel(friend.starCount) },
        createdAt: r.updatedAt,
      };
    });

    res.json(friends);
  } catch (err) {
    next(err);
  }
}

// GET /api/social/friends/requests
async function getPendingRequests(req, res, next) {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: req.user.id, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests.map(r => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromProfile: { ...r.fromUser, ...getLevel(r.fromUser.starCount) },
      status: r.status,
      createdAt: r.createdAt,
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/social/friends/requests  { toUserId }
async function sendFriendRequest(req, res, next) {
  try {
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId gerekli.' });
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Kendinize istek gönderemezsiniz.' });

    // Karşı yönde bekleyen istek var mı?
    const reverse = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: req.user.id } },
    });
    if (reverse && reverse.status === 'PENDING') {
      // Doğrudan kabul et
      const accepted = await prisma.friendRequest.update({
        where: { id: reverse.id },
        data: { status: 'ACCEPTED' },
      });
      await awardStars(req.user.id, 'FRIEND_ADDED', `${toUserId} ile arkadaş oldun`, accepted.id);
      return res.json({ message: 'Karşılıklı istek — arkadaşlık onaylandı.', request: accepted });
    }

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user.id, toUserId },
    });

    res.status(201).json(request);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu kullanıcıya zaten istek gönderildi.' });
    }
    next(err);
  }
}

// POST /api/social/friends/requests/:id/accept
async function acceptFriendRequest(req, res, next) {
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'İstek bulunamadı.' });
    if (request.toUserId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'İstek zaten işlendi.' });

    const updated = await prisma.friendRequest.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
      include: {
        fromUser: { select: { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true } },
      },
    });

    const { event, newStarCount, newRewards } = await awardStars(
      req.user.id,
      'FRIEND_ADDED',
      `${updated.fromUser.displayName} ile arkadaş oldun`,
      updated.id,
    );

    res.json({
      friend: {
        id: updated.id,
        profile: { ...updated.fromUser, ...getLevel(updated.fromUser.starCount) },
        createdAt: updated.updatedAt,
      },
      starEvent: event,
      newStarCount,
      newRewards,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/social/friends/requests/:id/reject
async function rejectFriendRequest(req, res, next) {
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'İstek bulunamadı.' });
    if (request.toUserId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    await prisma.friendRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });

    res.json({ message: 'İstek reddedildi.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/social/friends/:id
async function removeFriend(req, res, next) {
  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Arkadaşlık bulunamadı.' });

    const isParty = request.fromUserId === req.user.id || request.toUserId === req.user.id;
    if (!isParty) return res.status(403).json({ error: 'Yetkisiz.' });

    await prisma.friendRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Arkadaşlık kaldırıldı.' });
  } catch (err) {
    next(err);
  }
}

// ─── Öneriler ────────────────────────────────────────────────────────────────

// POST /api/social/recommendations
// Body: { toUserIds[], placeId, placeName, placeAddress?, placePhotoUrl?, placeRating?, placeTypes[], message? }
async function sendRecommendation(req, res, next) {
  try {
    const { toUserIds = [], placeId, placeName, placeAddress, placePhotoUrl, placeRating, placeTypes = [], message } = req.body;

    if (!placeId || !placeName) return res.status(400).json({ error: 'placeId ve placeName gerekli.' });

    const baseData = {
      fromUserId: req.user.id,
      placeId,
      placeName,
      placeAddress: placeAddress ?? null,
      placePhotoUrl: placePhotoUrl ?? null,
      placeRating: placeRating ?? null,
      placeTypes,
      message: message?.trim() ?? null,
    };

    let created;
    if (toUserIds.length === 0) {
      // Herkese açık paylaşım
      created = [await prisma.recommendation.create({ data: { ...baseData, toUserId: null } })];
    } else {
      created = await prisma.$transaction(
        toUserIds.map(uid =>
          prisma.recommendation.create({ data: { ...baseData, toUserId: uid } }),
        ),
      );
    }

    const { event, newStarCount, newRewards } = await awardStars(
      req.user.id,
      'RECOMMENDATION',
      `${placeName}'ı paylaştın`,
      created[0].id,
    );

    res.status(201).json({ recommendations: created, starEvent: event, newStarCount, newRewards });
  } catch (err) {
    next(err);
  }
}

// GET /api/social/recommendations/mine
async function getMyRecommendations(req, res, next) {
  try {
    const recs = await prisma.recommendation.findMany({
      where: { fromUserId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recs);
  } catch (err) {
    next(err);
  }
}

// GET /api/social/recommendations/received
async function getReceivedRecommendations(req, res, next) {
  try {
    const recs = await prisma.recommendation.findMany({
      where: { toUserId: req.user.id },
      include: {
        fromUser: { select: { id: true, displayName: true, photoUrl: true, starCount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recs.map(r => ({
      ...r,
      fromProfile: { ...r.fromUser, ...getLevel(r.fromUser.starCount) },
    })));
  } catch (err) {
    next(err);
  }
}

// GET /api/social/recommendations/user/:userId
async function getUserRecommendations(req, res, next) {
  try {
    const { userId } = req.params;

    // Gizli profil kontrolü
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isPublic: true } });
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (!target.isPublic && userId !== req.user.id) {
      const friendship = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: req.user.id, toUserId: userId },
            { fromUserId: userId, toUserId: req.user.id },
          ],
          status: 'ACCEPTED',
        },
      });
      if (!friendship) return res.json([]);
    }

    const recs = await prisma.recommendation.findMany({
      where: { fromUserId: userId, toUserId: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json(recs);
  } catch (err) {
    next(err);
  }
}

// ─── Yıldız Geçmişi ──────────────────────────────────────────────────────────

// GET /api/social/stars
async function getStarEvents(req, res, next) {
  try {
    const events = await prisma.starEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

// ─── Ödüller ─────────────────────────────────────────────────────────────────

// GET /api/social/rewards
async function getRewards(req, res, next) {
  try {
    const [rewards, userRewards] = await Promise.all([
      prisma.reward.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.userReward.findMany({ where: { userId: req.user.id }, select: { rewardId: true, unlockedAt: true } }),
    ]);

    const unlockedMap = new Map(userRewards.map(r => [r.rewardId, r.unlockedAt]));

    res.json(rewards.map(r => ({
      ...r,
      isUnlocked: unlockedMap.has(r.id),
      unlockedAt: unlockedMap.get(r.id) ?? null,
    })));
  } catch (err) {
    next(err);
  }
}

// ─── Anlık Puanlama ──────────────────────────────────────────────────────────

// POST /api/social/stars/rating  { placeId, placeName }
// Her kullanıcı, aynı restoran için 24 saatte bir hızlı puan verebilir.
async function rateRestaurant(req, res, next) {
  try {
    const { placeId, placeName } = req.body;
    if (!placeId || !placeName) return res.status(400).json({ error: 'placeId ve placeName gerekli.' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.starEvent.findFirst({
      where: {
        userId: req.user.id,
        type: 'RATING',
        referenceId: placeId,
        createdAt: { gte: since },
      },
    });
    if (recent) {
      return res.status(429).json({ error: 'Bu restoran için bugün zaten puan verdin.' });
    }

    const { event, newStarCount, newRewards } = await awardStars(
      req.user.id,
      'RATING',
      `${placeName}'ı puanladın`,
      placeId,
    );

    res.status(201).json({ starEvent: event, newStarCount, newRewards });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchUsers,
  getFriends, getPendingRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  sendRecommendation, getMyRecommendations, getReceivedRecommendations, getUserRecommendations,
  getStarEvents,
  getRewards,
  rateRestaurant,
};
