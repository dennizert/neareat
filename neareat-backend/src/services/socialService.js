'use strict';

/**
 * Sosyal grafik iş mantığı (S22-2): arkadaşlık, öneriler, itibar (yıldız/ödül),
 * liderlik tablosu, şikayet ve aktivite akışı.
 *
 * S22-1 konvansiyonunu izler: fonksiyonlar `req`/`res` almaz, beklenen iş hataları
 * `HttpError` ile bildirilir, `logRequest` controller'da kalır.
 *
 * Bazı fonksiyonlar yalnızca `userId` değil, işlemi yapanın `displayName`/`starCount`
 * alanlarına da ihtiyaç duyar (bildirim metni, liderlik sıralaması). Bunlar `actor`
 * nesnesi olarak geçilir — servisin `req`'e bağlanmaması için.
 *
 * YILDIZ MANTIĞI BURADA YENİDEN YAZILMAZ: `utils/stars` (awardStars/getLevel) ve
 * `utils/starGuards` (canEarnPlaceStars) tek kaynaktır. S18 seviye zinciri (özellik
 * erişimi) bu hesaba bağlı olduğundan kopyalanması sessiz bir regresyon riski olurdu.
 */

const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { awardStars, getLevel } = require('../utils/stars');
const { canEarnPlaceStars } = require('../utils/starGuards');
const { isPremiumUser } = require('../utils/premiumCheck');
const { createNotification, createNotificationsForUsers } = require('./notificationService');
const { logActivity, ACTIVITY_TYPES } = require('./logService');
const { getCachedSuggestions, computeSuggestionsForUser, invalidateSuggestions } = require('./friendSuggestionService');
const { PUBLIC_USER_SELECT } = require('../utils/userDto');
const { maskName, canViewUserContent, RANK_MEDALS } = require('../utils/socialPrivacy');

const FREE_DAILY_REC_LIMIT = 1;

// Sosyal aktivite akışı (S4-5)
const FEED_DEFAULT_LIMIT = 20;
const FEED_MAX_LIMIT = 50;
const FEED_WINDOW_DAYS = 7;

// Arkadaş kartlarında gösterilen alanlar (public karttan daha geniş: bio/city/starCount).
const FRIEND_SELECT = { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true, isPublic: true };
const REQUESTER_SELECT = { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true };

/** Kullanıcının kabul edilmiş arkadaşlıklarından karşı taraf id'lerini çıkarır. */
function otherPartyIds(rows, userId) {
  return rows.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId));
}

// ─── Kullanıcı arama ─────────────────────────────────────────────────────────

async function searchUsers(userId, { q, page: rawPage, limit: rawLimit }) {
  const query = (q || '').trim();
  if (!query) return [];

  // Sayfalama — eskiden sabit ilk 20 dönüyordu (2. sayfa aynı sonuçları veriyordu).
  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(rawLimit, 10) || 20));

  const [acceptedRequests, pendingSent] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: 'ACCEPTED' },
      select: { fromUserId: true, toUserId: true },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: userId, status: 'PENDING' },
      select: { toUserId: true },
    }),
  ]);

  const friendIds = new Set(otherPartyIds(acceptedRequests, userId));
  const pendingIds = new Set(pendingSent.map((r) => r.toUserId));

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      role: 'USER',
      isSuspended: false,
      displayName: { contains: query, mode: 'insensitive' },
    },
    select: { id: true, displayName: true, photoUrl: true, bio: true, city: true, starCount: true, isPublic: true },
    orderBy: [{ starCount: 'desc' }, { displayName: 'asc' }], // sayfalama için kararlı sıra
    take: limit,
    skip: (page - 1) * limit,
  });

  return users.map((u) => ({
    ...u,
    ...getLevel(u.starCount),
    isFriend: friendIds.has(u.id),
    hasPendingRequest: pendingIds.has(u.id),
  }));
}

// ─── Arkadaşlık ──────────────────────────────────────────────────────────────

async function getFriends(userId) {
  const requests = await prisma.friendRequest.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: 'ACCEPTED' },
    include: { fromUser: { select: FRIEND_SELECT }, toUser: { select: FRIEND_SELECT } },
    orderBy: { updatedAt: 'desc' },
  });

  return requests.map((r) => {
    const friend = r.fromUserId === userId ? r.toUser : r.fromUser;
    return {
      id: r.id,
      userId: friend.id,
      profile: { ...friend, ...getLevel(friend.starCount) },
      createdAt: r.updatedAt,
    };
  });
}

async function getPendingRequests(userId) {
  const requests = await prisma.friendRequest.findMany({
    where: { toUserId: userId, status: 'PENDING' },
    include: { fromUser: { select: REQUESTER_SELECT } },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromProfile: { ...r.fromUser, ...getLevel(r.fromUser.starCount) },
    status: r.status,
    note: r.note ?? null,
    createdAt: r.createdAt,
  }));
}

/**
 * @param {{ id: string, displayName: string }} actor bildirim metni gönderenin adını içerir
 * @returns {{ status: number, body: object, autoAccepted: boolean, toUserId: string }}
 */
async function sendFriendRequest(actor, { toUserId, note }) {
  if (!toUserId) throw new HttpError(400, { error: 'toUserId gerekli.' });
  if (toUserId === actor.id) throw new HttpError(400, { error: 'Kendinize istek gönderemezsiniz.' });

  const trimmedNote = note?.trim() || null;
  if (trimmedNote && trimmedNote.length > 300) {
    throw new HttpError(400, { error: 'Not en fazla 300 karakter olabilir.' });
  }

  // Karşı yönde bekleyen istek var mı? → doğrudan kabul et
  const reverse = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: actor.id } },
  });
  if (reverse && reverse.status === 'PENDING') {
    const accepted = await prisma.friendRequest.update({
      where: { id: reverse.id },
      data: { status: 'ACCEPTED' },
    });
    await awardStars(actor.id, 'FRIEND_ADDED', `${toUserId} ile arkadaş oldun`, accepted.id);
    await invalidateSuggestions(actor.id, toUserId);
    return {
      status: 200,
      autoAccepted: true,
      body: { message: 'Karşılıklı istek — arkadaşlık onaylandı.', autoAccepted: true, request: accepted },
    };
  }

  // Kendi yönümde mevcut istek var mı?
  const existing = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: actor.id, toUserId } },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      throw new HttpError(400, { error: 'Bu kullanıcı zaten arkadaş listenizde.' });
    }
    if (existing.status === 'PENDING') {
      throw new HttpError(409, { error: 'Bu kullanıcıya zaten istek gönderildi.' });
    }
    // REJECTED → not güncelle ve PENDING'e döndür
    const updated = await prisma.friendRequest.update({
      where: { id: existing.id },
      data: { status: 'PENDING', note: trimmedNote },
    });
    const notifBody = trimmedNote
      ? `${actor.displayName} sana tekrar arkadaşlık isteği gönderdi: "${trimmedNote}"`
      : `${actor.displayName} sana tekrar arkadaşlık isteği gönderdi`;
    createNotification(toUserId, 'FRIEND_REQUEST', 'Arkadaş Daveti', notifBody,
      { fromUserId: actor.id, fromUserName: actor.displayName, note: trimmedNote }).catch(() => {});
    await invalidateSuggestions(actor.id, toUserId);
    return { status: 201, autoAccepted: false, body: updated };
  }

  const request = await prisma.friendRequest.create({
    data: { fromUserId: actor.id, toUserId, note: trimmedNote },
  });

  const notifBody = trimmedNote
    ? `${actor.displayName} sana arkadaşlık isteği gönderdi: "${trimmedNote}"`
    : `${actor.displayName} sana arkadaşlık isteği gönderdi`;

  createNotification(
    toUserId,
    'FRIEND_REQUEST',
    'Arkadaş Daveti',
    notifBody,
    { fromUserId: actor.id, fromUserName: actor.displayName, note: trimmedNote },
  ).catch(() => {});

  await invalidateSuggestions(actor.id, toUserId);
  return { status: 201, autoAccepted: false, body: request };
}

async function acceptFriendRequest(userId, requestId) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, { error: 'İstek bulunamadı.' });
  if (request.toUserId !== userId) throw new HttpError(403, { error: 'Yetkisiz.' });
  if (request.status !== 'PENDING') throw new HttpError(400, { error: 'İstek zaten işlendi.' });

  const updated = await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'ACCEPTED' },
    include: { fromUser: { select: REQUESTER_SELECT } },
  });

  const { event, newStarCount, newRewards } = await awardStars(
    userId,
    'FRIEND_ADDED',
    `${updated.fromUser.displayName} ile arkadaş oldun`,
    updated.id,
  );

  await invalidateSuggestions(userId, updated.fromUser.id);

  return {
    fromUserId: updated.fromUser.id,
    body: {
      friend: {
        id: updated.id,
        profile: { ...updated.fromUser, ...getLevel(updated.fromUser.starCount) },
        createdAt: updated.updatedAt,
      },
      starEvent: event,
      newStarCount,
      newRewards,
    },
  };
}

async function rejectFriendRequest(userId, requestId) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, { error: 'İstek bulunamadı.' });
  if (request.toUserId !== userId) throw new HttpError(403, { error: 'Yetkisiz.' });

  await prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
  await invalidateSuggestions(userId, request.fromUserId);

  return { fromUserId: request.fromUserId, body: { message: 'İstek reddedildi.' } };
}

async function removeFriend(userId, requestId) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, { error: 'Arkadaşlık bulunamadı.' });

  const isParty = request.fromUserId === userId || request.toUserId === userId;
  if (!isParty) throw new HttpError(403, { error: 'Yetkisiz.' });

  const otherId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
  await prisma.friendRequest.delete({ where: { id: requestId } });
  await invalidateSuggestions(userId, otherId);

  return { otherId, body: { message: 'Arkadaşlık kaldırıldı.' } };
}

// ─── Öneriler ────────────────────────────────────────────────────────────────

/**
 * @param {{ id: string, displayName: string }} actor
 */
async function sendRecommendation(actor, input) {
  const {
    toUserIds = [], placeId, placeName, placeAddress, placePhotoUrl,
    placeRating, placeTypes = [], message,
  } = input;

  if (!placeId || !placeName) throw new HttpError(400, { error: 'placeId ve placeName gerekli.' });

  // Günlük öneri limiti — ücretsiz kullanıcılar günde max 1 öneri gönderebilir
  const premium = await isPremiumUser(actor.id);
  if (!premium) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyCount = await prisma.recommendation.count({
      where: { fromUserId: actor.id, createdAt: { gte: today } },
    });
    const newCount = toUserIds.length === 0 ? 1 : toUserIds.length;
    if (dailyCount + newCount > FREE_DAILY_REC_LIMIT) {
      throw new HttpError(403, {
        error: `Günlük öneri limitinize (${FREE_DAILY_REC_LIMIT}) ulaştınız`,
        code: 'PREMIUM_REQUIRED',
      });
    }
  }

  const baseData = {
    fromUserId: actor.id,
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
    // Çok alıcılı gönderim tek transaction — kısmi gönderim olmamalı.
    created = await prisma.$transaction(
      toUserIds.map((uid) => prisma.recommendation.create({ data: { ...baseData, toUserId: uid } })),
    );
  }

  // Sosyal aktivite akışı — bir gönderim = bir olay (alıcı sayısından bağımsız)
  logActivity({
    userId: actor.id,
    type: ACTIVITY_TYPES.RECOMMENDATION,
    placeId,
    metadata: { placeName: placeName || null },
  });

  const starMultiplier = premium ? 2 : 1;
  const { event, newStarCount, newRewards } = await awardStars(
    actor.id,
    'RECOMMENDATION',
    `${placeName}'ı paylaştın`,
    created[0].id,
    starMultiplier,
  );

  // Öneri bildirimleri (fire-and-forget)
  if (toUserIds.length > 0) {
    createNotificationsForUsers(
      toUserIds,
      'RECOMMENDATION',
      'Restoran Önerisi',
      `${actor.displayName} sana "${placeName}" restoranını önerdi`,
      { fromUserId: actor.id, fromUserName: actor.displayName, placeId, placeName },
    ).catch(() => {});
  }

  return { recommendations: created, starEvent: event, newStarCount, newRewards };
}

async function getMyRecommendations(userId) {
  return prisma.recommendation.findMany({
    where: { fromUserId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

async function getReceivedRecommendations(userId) {
  const recs = await prisma.recommendation.findMany({
    where: { toUserId: userId },
    include: { fromUser: { select: { id: true, displayName: true, photoUrl: true, starCount: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return recs.map((r) => ({ ...r, fromProfile: { ...r.fromUser, ...getLevel(r.fromUser.starCount) } }));
}

async function getUserRecommendations(viewerId, targetUserId) {
  // Gizli profil kontrolü
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { isPublic: true } });
  if (!target) throw new HttpError(404, { error: 'Kullanıcı bulunamadı.' });

  const isSelf = targetUserId === viewerId;
  let isFriend = false;
  if (!target.isPublic && !isSelf) {
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: viewerId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: viewerId },
        ],
        status: 'ACCEPTED',
      },
    });
    isFriend = Boolean(friendship);
  }

  // Görünürlük kararı saf çekirdekte (utils/socialPrivacy) — testi doğrudan yazılabilir.
  if (!canViewUserContent({ isPublic: target.isPublic, isSelf, isFriend })) return [];

  return prisma.recommendation.findMany({
    where: { fromUserId: targetUserId, toUserId: null },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Yıldız geçmişi & ödüller ────────────────────────────────────────────────

async function getStarEvents(userId) {
  return prisma.starEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

async function getRewards(userId) {
  const [rewards, userRewards] = await Promise.all([
    prisma.reward.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.userReward.findMany({ where: { userId }, select: { rewardId: true, unlockedAt: true } }),
  ]);

  const unlockedMap = new Map(userRewards.map((r) => [r.rewardId, r.unlockedAt]));

  return rewards.map((r) => ({
    ...r,
    isUnlocked: unlockedMap.has(r.id),
    unlockedAt: unlockedMap.get(r.id) ?? null,
  }));
}

// ─── Anlık puanlama ──────────────────────────────────────────────────────────

async function rateRestaurant(userId, { placeId, placeName }) {
  if (!placeId || !placeName) throw new HttpError(400, { error: 'placeId ve placeName gerekli.' });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.starEvent.findFirst({
    where: { userId, type: 'RATING', referenceId: placeId, createdAt: { gte: since } },
  });
  if (recent) throw new HttpError(429, { error: 'Bu restoran için bugün zaten puan verdin.' });

  // S18-3: Puan yıldızı yalnızca DOĞRULANMIŞ ZİYARET varsa ve günlük tavanın altındaysa
  // verilir (farming önleme). Aksi halde 403 (puanlama bir yıldız aksiyonu; ziyaret şart).
  const { visited, underCap } = await canEarnPlaceStars(userId, placeId, 'RATING');
  if (!visited) {
    throw new HttpError(403, {
      error: 'Bir restoranı puanlamak için önce ziyaret etmelisin (check-in veya tamamlanmış rezervasyon).',
      code: 'VISIT_REQUIRED',
    });
  }
  if (!underCap) {
    throw new HttpError(429, { error: 'Günlük puanlama limitine ulaştın, yarın tekrar dene.' });
  }

  const { event, newStarCount, newRewards } = await awardStars(userId, 'RATING', `${placeName}'ı puanladın`, placeId);
  return { starEvent: event, newStarCount, newRewards };
}

// ─── Liderlik tablosu ────────────────────────────────────────────────────────

/**
 * @param {{ id: string, starCount: number }} actor sıralama kendi yıldızına göre hesaplanır
 */
async function getLeaderboard(actor) {
  const [top5, myRank] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'USER', isSuspended: false },
      orderBy: { starCount: 'desc' },
      take: 5,
      select: { id: true, displayName: true, starCount: true },
    }),
    prisma.user.count({
      where: { role: 'USER', isSuspended: false, starCount: { gt: actor.starCount } },
    }),
  ]);

  return {
    top5: top5.map((u, i) => ({
      rank: i + 1,
      medal: RANK_MEDALS[i],
      // Sıralama herkese açık → gerçek ad maskelenir (utils/socialPrivacy).
      maskedName: maskName(u.displayName),
      starCount: u.starCount,
      ...getLevel(u.starCount),
      isMe: u.id === actor.id,
    })),
    myRank: myRank + 1,
    myStarCount: actor.starCount,
  };
}

// ─── Arkadaş önerileri ───────────────────────────────────────────────────────

async function getFriendSuggestions(userId) {
  let suggestions = await getCachedSuggestions(userId);
  if (!suggestions) {
    suggestions = await computeSuggestionsForUser(userId);
  }

  // Yüksek eşleşme için bildirim gönder (24 saatte bir, en fazla 1 bildirim)
  if (suggestions.length > 0 && suggestions[0].matchScore >= 60) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'FRIEND_SUGGESTION',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!recent) {
      const top = suggestions[0];
      createNotification(
        userId,
        'FRIEND_SUGGESTION',
        'Yeni Arkadaş Önerisi 🤝',
        `Seninle çok ortak noktası olan biri var! (${top.matchReasons.slice(0, 2).join(', ')})`,
        { suggestedUserId: top.userId },
      ).catch(() => {});
    }
  }

  return { suggestions };
}

// ─── Şikayet ─────────────────────────────────────────────────────────────────

async function reportUser(reporterId, reportedId, { reason }) {
  if (!reason?.trim()) throw new HttpError(400, { error: 'Şikayet sebebi zorunludur.' });
  if (reason.trim().length > 1000) throw new HttpError(400, { error: 'Şikayet sebebi en fazla 1000 karakter olabilir.' });
  if (reportedId === reporterId) throw new HttpError(400, { error: 'Kendinizi şikayet edemezsiniz.' });

  const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
  if (!target) throw new HttpError(404, { error: 'Kullanıcı bulunamadı.' });

  // Son 24 saatte aynı kullanıcıyı zaten şikayet etmiş mi?
  const recent = await prisma.userReport.findFirst({
    where: { reporterId, reportedId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recent) throw new HttpError(429, { error: 'Bu kullanıcıyı son 24 saat içinde zaten şikayet ettiniz.' });

  await prisma.userReport.create({ data: { reporterId, reportedId, reason: reason.trim() } });

  return { message: 'Şikayetiniz alındı. Admin ekibimiz inceleyecektir.' };
}

// ─── Aktivite akışı (S4-5) ───────────────────────────────────────────────────

async function getActivityFeed(userId, { limit: rawLimit, cursor: rawCursor }) {
  const limit = Math.min(FEED_MAX_LIMIT, Math.max(1, parseInt(rawLimit, 10) || FEED_DEFAULT_LIMIT));
  const cursor = typeof rawCursor === 'string' && rawCursor ? rawCursor : null;

  // 1. Arkadaş id'leri (kabul edilmiş, her iki yön)
  const friendships = await prisma.friendRequest.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }], status: 'ACCEPTED' },
    select: { fromUserId: true, toUserId: true },
  });

  const friendIds = otherPartyIds(friendships, userId);
  if (friendIds.length === 0) return { events: [], nextCursor: null };

  // 2. Son 7 günün event'leri — tek query (N+1 yok), limit+1 ile "daha var mı"
  const since = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.activityEvent.findMany({
    where: { userId: { in: friendIds }, createdAt: { gte: since } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

  // 3. Event sahiplerinin profilleri — tek query, Map ile eşle
  const userIds = [...new Set(pageRows.map((e) => e.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: PUBLIC_USER_SELECT,
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const events = pageRows.map((e) => ({
    id: e.id,
    type: e.type,
    placeId: e.placeId,
    metadata: e.metadata ?? null,
    createdAt: e.createdAt,
    user: userById.get(e.userId) ?? { id: e.userId, displayName: null, photoUrl: null },
  }));

  return { events, nextCursor };
}

module.exports = {
  searchUsers,
  getFriends, getPendingRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, removeFriend,
  sendRecommendation, getMyRecommendations, getReceivedRecommendations, getUserRecommendations,
  getStarEvents, getRewards, rateRestaurant,
  getLeaderboard, getFriendSuggestions, reportUser, getActivityFeed,
  // Sabitler — test ve yeniden kullanım için
  FREE_DAILY_REC_LIMIT, FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT, FEED_WINDOW_DAYS,
};
