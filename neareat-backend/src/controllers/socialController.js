const prisma = require('../utils/prisma');
const { awardStars, getLevel } = require('../utils/stars');
const { isPremiumUser } = require('../utils/premiumCheck');
const { createNotification, createNotificationsForUsers } = require('../services/notificationService');
const { logRequest, logActivity, ACTIVITY_TYPES } = require('../services/logService');

const FREE_DAILY_REC_LIMIT = 2;

// ─── Kullanıcı Arama ─────────────────────────────────────────────────────────

// GET /api/social/users/search?q=
async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    // Mevcut ilişkileri bul (ACCEPTED → isFriend, PENDING sent by me → hasPendingRequest)
    const [acceptedRequests, pendingSent] = await Promise.all([
      prisma.friendRequest.findMany({
        where: {
          OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }],
          status: 'ACCEPTED',
        },
        select: { fromUserId: true, toUserId: true },
      }),
      prisma.friendRequest.findMany({
        where: { fromUserId: req.user.id, status: 'PENDING' },
        select: { toUserId: true },
      }),
    ]);

    const friendIds = new Set(
      acceptedRequests.flatMap(r =>
        [r.fromUserId, r.toUserId].filter(id => id !== req.user.id),
      ),
    );
    const pendingIds = new Set(pendingSent.map(r => r.toUserId));

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        role: 'USER',
        isSuspended: false,
        displayName: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true, displayName: true, photoUrl: true,
        bio: true, city: true, starCount: true, isPublic: true,
      },
      take: 20,
    });

    res.json(users.map(u => ({
      ...u,
      ...getLevel(u.starCount),
      isFriend: friendIds.has(u.id),
      hasPendingRequest: pendingIds.has(u.id),
    })));
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
        userId: friend.id,
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
      note: r.note ?? null,
      createdAt: r.createdAt,
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/social/friends/requests  { toUserId, note? }
async function sendFriendRequest(req, res, next) {
  try {
    const { toUserId, note } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId gerekli.' });
    if (toUserId === req.user.id) return res.status(400).json({ error: 'Kendinize istek gönderemezsiniz.' });

    const trimmedNote = note?.trim() || null;
    if (trimmedNote && trimmedNote.length > 300) {
      return res.status(400).json({ error: 'Not en fazla 300 karakter olabilir.' });
    }

    // Karşı yönde bekleyen istek var mı? → doğrudan kabul et
    const reverse = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: req.user.id } },
    });
    if (reverse && reverse.status === 'PENDING') {
      const accepted = await prisma.friendRequest.update({
        where: { id: reverse.id },
        data: { status: 'ACCEPTED' },
      });
      await awardStars(req.user.id, 'FRIEND_ADDED', `${toUserId} ile arkadaş oldun`, accepted.id);
      logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği gönderdi (karşılıklı — otomatik kabul)', details: toUserId }).catch(() => {});
      return res.json({ message: 'Karşılıklı istek — arkadaşlık onaylandı.', autoAccepted: true, request: accepted });
    }

    // Kendi yönümde mevcut istek var mı?
    const existing = await prisma.friendRequest.findUnique({
      where: { fromUserId_toUserId: { fromUserId: req.user.id, toUserId } },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return res.status(400).json({ error: 'Bu kullanıcı zaten arkadaş listenizde.' });
      }
      if (existing.status === 'PENDING') {
        return res.status(409).json({ error: 'Bu kullanıcıya zaten istek gönderildi.' });
      }
      // REJECTED → not güncelle ve PENDING'e döndür
      const updated = await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING', note: trimmedNote },
      });
      const notifBody = trimmedNote
        ? `${req.user.displayName} sana tekrar arkadaşlık isteği gönderdi: "${trimmedNote}"`
        : `${req.user.displayName} sana tekrar arkadaşlık isteği gönderdi`;
      createNotification(toUserId, 'FRIEND_REQUEST', 'Arkadaş Daveti', notifBody,
        { fromUserId: req.user.id, fromUserName: req.user.displayName, note: trimmedNote }).catch(() => {});
      return res.status(201).json(updated);
    }

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user.id, toUserId, note: trimmedNote },
    });

    const notifBody = trimmedNote
      ? `${req.user.displayName} sana arkadaşlık isteği gönderdi: "${trimmedNote}"`
      : `${req.user.displayName} sana arkadaşlık isteği gönderdi`;

    createNotification(
      toUserId,
      'FRIEND_REQUEST',
      'Arkadaş Daveti',
      notifBody,
      { fromUserId: req.user.id, fromUserName: req.user.displayName, note: trimmedNote },
    ).catch(() => {});

    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği gönderdi', details: toUserId }).catch(() => {});
    res.status(201).json(request);
  } catch (err) {
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

    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği kabul etti', details: updated.fromUser.id }).catch(() => {});
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

    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşlık isteği reddetti', details: request.fromUserId }).catch(() => {});
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

    const otherId = request.fromUserId === req.user.id ? request.toUserId : request.fromUserId;
    logRequest({ req, page: 'Arkadaşlar', action: 'Arkadaşı kaldırdı', details: otherId }).catch(() => {});
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

    // Günlük öneri limiti — ücretsiz kullanıcılar günde max 2 öneri gönderebilir
    const premium = await isPremiumUser(req.user.id);
    if (!premium) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyCount = await prisma.recommendation.count({
        where: { fromUserId: req.user.id, createdAt: { gte: today } },
      });
      const newCount = toUserIds.length === 0 ? 1 : toUserIds.length;
      if (dailyCount + newCount > FREE_DAILY_REC_LIMIT) {
        return res.status(403).json({
          error: `Günlük öneri limitinize (${FREE_DAILY_REC_LIMIT}) ulaştınız`,
          code: 'PREMIUM_REQUIRED',
        });
      }
    }

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

    // Sosyal aktivite akışı — bir gönderim = bir olay (alıcı sayısından bağımsız)
    logActivity({
      userId: req.user.id,
      type: ACTIVITY_TYPES.RECOMMENDATION,
      placeId,
      metadata: { placeName: placeName || null },
    });

    const starMultiplier = premium ? 2 : 1;
    const { event, newStarCount, newRewards } = await awardStars(
      req.user.id,
      'RECOMMENDATION',
      `${placeName}'ı paylaştın`,
      created[0].id,
      starMultiplier,
    );

    // Öneri bildirimleri
    if (toUserIds.length > 0) {
      createNotificationsForUsers(
        toUserIds,
        'RECOMMENDATION',
        'Restoran Önerisi',
        `${req.user.displayName} sana "${placeName}" restoranını önerdi`,
        { fromUserId: req.user.id, fromUserName: req.user.displayName, placeId, placeName },
      ).catch(() => {});
    }

    logRequest({ req, page: 'Restoran', action: 'Restoran önerdi', details: placeName }).catch(() => {});
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

    const ratingPremium = await isPremiumUser(req.user.id);
    const { event, newStarCount, newRewards } = await awardStars(
      req.user.id,
      'RATING',
      `${placeName}'ı puanladın`,
      placeId,
      ratingPremium ? 2 : 1,
    );

    logRequest({ req, page: 'Restoran', action: 'Restoran puanladı', details: placeName }).catch(() => {});
    res.status(201).json({ starEvent: event, newStarCount, newRewards });
  } catch (err) {
    next(err);
  }
}

// ─── Liderlik Listesi ─────────────────────────────────────────────────────────

function maskName(displayName) {
  const words = (displayName || '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2) + '...';
  return words[0].slice(0, 2) + '. ' + words[words.length - 1].slice(0, 2) + '...';
}

// GET /api/social/leaderboard
async function getLeaderboard(req, res, next) {
  try {
    const [top5, myRank] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'USER', isSuspended: false },
        orderBy: { starCount: 'desc' },
        take: 5,
        select: { id: true, displayName: true, starCount: true },
      }),
      prisma.user.count({
        where: { role: 'USER', isSuspended: false, starCount: { gt: req.user.starCount } },
      }),
    ]);

    const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    res.json({
      top5: top5.map((u, i) => ({
        rank: i + 1,
        medal: RANK_MEDALS[i],
        maskedName: maskName(u.displayName),
        starCount: u.starCount,
        ...getLevel(u.starCount),
        isMe: u.id === req.user.id,
      })),
      myRank: myRank + 1,
      myStarCount: req.user.starCount,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Arkadaş Önerileri ────────────────────────────────────────────────────────

// GET /api/social/friend-suggestions
async function getFriendSuggestions(req, res, next) {
  try {
    const user = req.user;

    const [myFavorites, myCollItems, existingRelations] = await Promise.all([
      prisma.favorite.findMany({ where: { userId: user.id }, select: { placeId: true } }),
      prisma.collectionItem.findMany({
        where: { collection: { userId: user.id } },
        select: { placeId: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          OR: [{ fromUserId: user.id }, { toUserId: user.id }],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { fromUserId: true, toUserId: true },
      }),
    ]);

    const myFavIds = new Set(myFavorites.map(f => f.placeId));
    const myCollIds = new Set(myCollItems.map(c => c.placeId));
    const myCuisines = new Set(user.favoriteCuisines || []);
    const excludedIds = new Set([
      user.id,
      ...existingRelations.flatMap(r => [r.fromUserId, r.toUserId]),
    ]);

    // Aday kullanıcılar
    const candidates = await prisma.user.findMany({
      where: { id: { notIn: [...excludedIds] }, role: 'USER', isSuspended: false, isPublic: true },
      select: { id: true, displayName: true, photoUrl: true, city: true, favoriteCuisines: true, starCount: true },
      take: 300,
    });

    if (candidates.length === 0) return res.json({ suggestions: [] });

    const candidateIds = candidates.map(c => c.id);

    // Adayların favori ve koleksiyon verilerini toplu çek
    const [candFavs, candCollItems] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId: { in: candidateIds } },
        select: { userId: true, placeId: true },
      }),
      prisma.collectionItem.findMany({
        where: { collection: { userId: { in: candidateIds } } },
        select: { placeId: true, collection: { select: { userId: true } } },
      }),
    ]);

    // userId → Set<placeId> map'leri
    const favMap = new Map();
    for (const f of candFavs) {
      if (!favMap.has(f.userId)) favMap.set(f.userId, new Set());
      favMap.get(f.userId).add(f.placeId);
    }
    const collMap = new Map();
    for (const ci of candCollItems) {
      const uid = ci.collection.userId;
      if (!collMap.has(uid)) collMap.set(uid, new Set());
      collMap.get(uid).add(ci.placeId);
    }

    const scored = candidates.map(c => {
      let score = 0;
      const reasons = [];

      if (user.city && c.city && user.city.trim().toLowerCase() === c.city.trim().toLowerCase()) {
        score += 30;
        reasons.push('Aynı şehir');
      }

      const cFavs = favMap.get(c.id) || new Set();
      const commonFavCount = [...myFavIds].filter(id => cFavs.has(id)).length;
      score += Math.min(commonFavCount * 15, 60);
      if (commonFavCount > 0) reasons.push(`${commonFavCount} ortak favori`);

      const cColls = collMap.get(c.id) || new Set();
      const commonCollCount = [...myCollIds].filter(id => cColls.has(id)).length;
      score += Math.min(commonCollCount * 10, 40);
      if (commonCollCount > 0) reasons.push(`${commonCollCount} ortak liste restoranı`);

      const cCuisines = new Set(c.favoriteCuisines || []);
      const commonCuisineCount = [...myCuisines].filter(cu => cCuisines.has(cu)).length;
      score += Math.min(commonCuisineCount * 20, 60);
      if (commonCuisineCount > 0) reasons.push(`${commonCuisineCount} ortak mutfak tercihi`);

      return {
        userId: c.id,
        maskedName: maskName(c.displayName),
        photoUrl: c.photoUrl,
        city: c.city,
        starCount: c.starCount,
        ...getLevel(c.starCount),
        matchScore: score,
        matchReasons: reasons,
        commonFavorites: commonFavCount,
        commonCollections: commonCollCount,
        commonCuisines: commonCuisineCount,
      };
    })
      .filter(c => c.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    // Yüksek eşleşme için bildirim gönder (24 saatte bir, en fazla 1 bildirim)
    if (scored.length > 0 && scored[0].matchScore >= 60) {
      const recent = await prisma.notification.findFirst({
        where: { userId: user.id, type: 'FRIEND_SUGGESTION', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (!recent) {
        const top = scored[0];
        createNotification(
          user.id,
          'FRIEND_SUGGESTION',
          'Yeni Arkadaş Önerisi 🤝',
          `Seninle çok ortak noktası olan biri var! (${top.matchReasons.slice(0, 2).join(', ')})`,
          { suggestedUserId: top.userId },
        ).catch(() => {});
      }
    }

    res.json({ suggestions: scored });
  } catch (err) {
    next(err);
  }
}

// ─── Kullanıcı Şikayet ────────────────────────────────────────────────────────

// POST /api/social/users/:userId/report  { reason }
async function reportUser(req, res, next) {
  try {
    const reporterId = req.user.id;
    const reportedId = req.params.userId;
    const { reason } = req.body;

    if (!reason?.trim()) return res.status(400).json({ error: 'Şikayet sebebi zorunludur.' });
    if (reason.trim().length > 1000) return res.status(400).json({ error: 'Şikayet sebebi en fazla 1000 karakter olabilir.' });
    if (reportedId === reporterId) return res.status(400).json({ error: 'Kendinizi şikayet edemezsiniz.' });

    // Hedef kullanıcı var mı?
    const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Son 24 saatte aynı kullanıcıyı zaten şikayet etmiş mi?
    const recent = await prisma.userReport.findFirst({
      where: {
        reporterId,
        reportedId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) return res.status(429).json({ error: 'Bu kullanıcıyı son 24 saat içinde zaten şikayet ettiniz.' });

    await prisma.userReport.create({
      data: { reporterId, reportedId, reason: reason.trim() },
    });

    logRequest({ req, page: 'Kullanıcı Profili', action: 'Kullanıcı şikayet etti', details: reportedId }).catch(() => {});
    res.status(201).json({ message: 'Şikayetiniz alındı. Admin ekibimiz inceleyecektir.' });
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
  getLeaderboard,
  getFriendSuggestions,
  reportUser,
};
