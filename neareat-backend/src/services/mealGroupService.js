'use strict';

/**
 * Yemek grupları iş mantığı (S23-2): grup kurma/davet, üye yönetimi ve restoran anketleri.
 *
 * S22-1 konvansiyonunu izler. Bu dosyada özellikle dikkat edilen iki nokta:
 *  - ÜYELİK/YETKİ kontrolü artık tek bir yardımcıda (`requireAcceptedMembership`) toplanır;
 *    dört ayrı akışta tekrarlanan bu kontrolün birinde atlanması yetki sızıntısı olurdu.
 *  - Kazanan hesabı saf `utils/pollResult` çekirdeğinde; beraberlik dahil doğrudan testli.
 */

const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { createNotification } = require('./notificationService');
const { getNearbyRestaurantsFast, getPhotoUrl, passesQualityFilter } = require('./googlePlaces');
const { PUBLIC_USER_SELECT } = require('../utils/userDto');
const { computePollWinner } = require('../utils/pollResult');

// Üye/oy kartlarında gösterilen minimal kullanıcı alanları (S21-1 ortak projeksiyon).
const MEMBER_SELECT = PUBLIC_USER_SELECT;
const POLL_CREATOR_SELECT = { id: true, displayName: true };

const MAX_GROUP_MEMBERS = 19; // kurucu hariç → grup toplamı 20
const MAX_POLL_OPTIONS = 8;
const MIN_POLL_OPTIONS = 2;
const QUICK_POLL_OPTION_COUNT = 5;

/** Anket sonuçlarıyla birlikte seçenekleri getiren ortak include bloğu. */
const POLL_INCLUDE = {
  creator: { select: POLL_CREATOR_SELECT },
  options: { include: { votes: { include: { user: { select: MEMBER_SELECT } } } } },
};

/**
 * Kullanıcının gruba KABUL EDİLMİŞ üye olduğunu doğrular.
 * Dört akış (anket açma, oy verme, üye ekleme, hızlı anket) aynı kuralı kullanır;
 * tek yerde toplanması birinde unutulma riskini yapısal olarak kaldırır.
 */
async function requireAcceptedMembership(groupId, userId, message) {
  const membership = await prisma.mealGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership || membership.status !== 'ACCEPTED') {
    throw new HttpError(403, { error: message });
  }
  return membership;
}

/** Grup üyelerine (işlemi yapan hariç) bildirim gönderir — fire-and-forget. */
async function notifyOtherMembers(groupId, actorId, { type, title, body, data }) {
  const members = await prisma.mealGroupMember.findMany({
    where: { groupId, status: 'ACCEPTED', userId: { not: actorId } },
    select: { userId: true },
  });
  for (const m of members) {
    createNotification(m.userId, type, title, body, data).catch(() => {});
  }
  return members;
}

/** Anket bildirimleri için grup adı + oluşturan adı. */
async function loadGroupAndActorNames(groupId, actorId) {
  const [group, actor] = await Promise.all([
    prisma.mealGroup.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true } }),
  ]);
  return { group, actor };
}

// ─── Gruplar ─────────────────────────────────────────────────────────────────

async function getMyGroups(userId) {
  const memberships = await prisma.mealGroupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          creator: { select: MEMBER_SELECT },
          members: { include: { user: { select: MEMBER_SELECT } } },
          polls: { where: { status: 'OPEN' }, take: 1, orderBy: { createdAt: 'desc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.group,
    myStatus: m.status,
    hasOpenPoll: m.group.polls.length > 0,
    polls: undefined,
  }));
}

async function getGroup(userId, groupId) {
  // Detayda INVITED üyeler de görebilir (davet ekranı) — ACCEPTED şartı yok.
  const membership = await prisma.mealGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new HttpError(403, { error: 'Bu gruba erişim yetkiniz yok.' });

  const group = await prisma.mealGroup.findUnique({
    where: { id: groupId },
    include: {
      creator: { select: MEMBER_SELECT },
      members: { include: { user: { select: MEMBER_SELECT } }, orderBy: { createdAt: 'asc' } },
      polls: {
        include: {
          creator: { select: POLL_CREATOR_SELECT },
          options: {
            include: { votes: { include: { user: { select: MEMBER_SELECT } } } },
            orderBy: { addedAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!group) throw new HttpError(404, { error: 'Grup bulunamadı.' });

  return { ...group, myStatus: membership.status };
}

/** Verilen id'lerden yalnızca kullanıcının KABUL EDİLMİŞ arkadaşlarını süzer. */
async function filterToFriends(userId, candidateIds) {
  if (candidateIds.length === 0) return [];
  const friends = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { fromUserId: userId, toUserId: { in: candidateIds } },
        { toUserId: userId, fromUserId: { in: candidateIds } },
      ],
    },
    select: { fromUserId: true, toUserId: true },
  });
  const friendIds = new Set(friends.map((f) => (f.fromUserId === userId ? f.toUserId : f.fromUserId)));
  return [...new Set(candidateIds.filter((id) => friendIds.has(id)))];
}

async function createGroup(userId, { name, memberIds = [] }) {
  if (!name?.trim()) throw new HttpError(400, { error: 'Grup adı zorunlu.' });
  if (name.trim().length > 100) throw new HttpError(400, { error: 'Grup adı en fazla 100 karakter olabilir.' });
  if (!Array.isArray(memberIds)) throw new HttpError(400, { error: 'Geçersiz üye listesi.' });
  if (memberIds.length > MAX_GROUP_MEMBERS) {
    throw new HttpError(400, { error: 'Bir gruba en fazla 20 üye eklenebilir.' });
  }

  // null/undefined değerleri filtrele (Prisma 6.x in:[] hata verir)
  const safeIds = memberIds.filter((id) => typeof id === 'string' && id.length > 0);
  // Davet edilenleri yalnızca kabul edilmiş arkadaşlıklarla sınırla (yetkisiz davet engeli).
  const validMemberIds = await filterToFriends(userId, safeIds);

  const group = await prisma.mealGroup.create({
    data: {
      name: name.trim(),
      creatorId: userId,
      members: {
        create: [
          { userId, status: 'ACCEPTED' },
          ...validMemberIds.map((id) => ({ userId: id, status: 'INVITED' })),
        ],
      },
    },
    include: {
      creator: { select: MEMBER_SELECT },
      members: { include: { user: { select: MEMBER_SELECT } } },
    },
  });

  // Davet bildirimleri
  const creator = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  for (const memberId of validMemberIds) {
    createNotification(
      memberId,
      'MEAL_GROUP_INVITE',
      'Grup Daveti',
      `${creator.displayName} seni "${group.name}" grubuna davet etti`,
      { groupId: group.id },
    ).catch(() => {});
  }

  return { ...group, myStatus: 'ACCEPTED', hasOpenPoll: false };
}

async function respondToInvite(userId, groupId, { status }) {
  if (!['ACCEPTED', 'DECLINED'].includes(status)) {
    throw new HttpError(400, { error: 'Geçersiz durum. ACCEPTED veya DECLINED olmalı.' });
  }

  const membership = await prisma.mealGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership || membership.status !== 'INVITED') {
    throw new HttpError(404, { error: 'Bekleyen davet bulunamadı.' });
  }

  const updated = await prisma.mealGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { status },
  });

  if (status === 'ACCEPTED') {
    const [group, user] = await Promise.all([
      prisma.mealGroup.findUnique({ where: { id: groupId }, select: { creatorId: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    ]);
    createNotification(
      group.creatorId,
      'MEAL_GROUP_JOINED',
      'Gruba Katılım',
      `${user.displayName} "${group.name}" grubuna katıldı`,
      { groupId },
    ).catch(() => {});
  }

  return updated;
}

async function addMembers(userId, groupId, { memberIds = [] }) {
  await requireAcceptedMembership(groupId, userId, 'Bu gruba üye ekleyemezsiniz.');

  const safeIds = (Array.isArray(memberIds) ? memberIds : []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (safeIds.length === 0) throw new HttpError(400, { error: 'Eklenecek üye belirtilmedi.' });

  const validIds = await filterToFriends(userId, safeIds);
  if (validIds.length === 0) {
    throw new HttpError(400, { error: 'Seçilenler arasında arkadaşınız bulunamadı.' });
  }

  // Zaten üye olanları atla (upsert yerine createMany skipDuplicates)
  await prisma.mealGroupMember.createMany({
    data: validIds.map((id) => ({ groupId, userId: id, status: 'INVITED' })),
    skipDuplicates: true,
  });

  const { group, actor } = await loadGroupAndActorNames(groupId, userId);
  for (const memberId of validIds) {
    createNotification(
      memberId,
      'MEAL_GROUP_INVITE',
      'Grup Daveti',
      `${actor.displayName} seni "${group.name}" grubuna davet etti`,
      { groupId },
    ).catch(() => {});
  }

  // Güncel grup bilgisini döndür
  return prisma.mealGroup.findUnique({
    where: { id: groupId },
    include: {
      creator: { select: MEMBER_SELECT },
      members: { include: { user: { select: MEMBER_SELECT } }, orderBy: { createdAt: 'asc' } },
    },
  });
}

// ─── Anketler ────────────────────────────────────────────────────────────────

/** Grupta açık olan anketi kapatır — grup başına tek açık anket kuralı. */
async function closeOpenPolls(groupId) {
  await prisma.restaurantPoll.updateMany({
    where: { groupId, status: 'OPEN' },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
}

async function createPoll(userId, groupId, { question, options = [] }) {
  await requireAcceptedMembership(groupId, userId, 'Bu grupta anket oluşturamazsınız.');

  if (!Array.isArray(options) || options.length < MIN_POLL_OPTIONS) {
    throw new HttpError(400, { error: 'En az 2 restoran seçeneği ekleyin.' });
  }
  if (options.length > MAX_POLL_OPTIONS) {
    throw new HttpError(400, { error: 'En fazla 8 seçenek eklenebilir.' });
  }
  for (const opt of options) {
    if (!opt.placeId || !opt.placeName) {
      throw new HttpError(400, { error: 'Her seçenek placeId ve placeName içermelidir.' });
    }
  }

  await closeOpenPolls(groupId);

  const poll = await prisma.restaurantPoll.create({
    data: {
      groupId,
      creatorId: userId,
      question: question?.trim() || null,
      options: {
        create: options.map((opt) => ({
          placeId: opt.placeId,
          placeName: opt.placeName,
          placeAddress: opt.placeAddress || null,
          placePhotoUrl: opt.placePhotoUrl || null,
          placeRating: opt.placeRating || null,
        })),
      },
    },
    include: POLL_INCLUDE,
  });

  const { group, actor } = await loadGroupAndActorNames(groupId, userId);
  await notifyOtherMembers(groupId, userId, {
    type: 'MEAL_GROUP_POLL',
    title: 'Yeni Anket',
    body: `${actor.displayName} "${group.name}" grubunda yeni bir anket başlattı`,
    data: { groupId, pollId: poll.id },
  });

  return poll;
}

async function vote(userId, groupId, pollId, { optionId, vote: voteValue }) {
  if (!['YES', 'NO', 'MAYBE'].includes(voteValue)) {
    throw new HttpError(400, { error: 'Geçersiz oy. YES, NO veya MAYBE olmalı.' });
  }

  const [membership, poll, option] = await Promise.all([
    prisma.mealGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }),
    prisma.restaurantPoll.findUnique({ where: { id: pollId } }),
    prisma.pollOption.findFirst({ where: { id: optionId, pollId } }),
  ]);

  if (!membership || membership.status !== 'ACCEPTED') {
    throw new HttpError(403, { error: 'Bu grupta oy kullanamazsınız.' });
  }
  if (!poll || poll.groupId !== groupId || poll.status !== 'OPEN') {
    throw new HttpError(400, { error: 'Bu anket artık aktif değil.' });
  }
  if (!option) throw new HttpError(404, { error: 'Seçenek bulunamadı.' });

  // upsert → aynı seçeneğe ikinci oy yeni kayıt açmaz, mevcut oyu günceller.
  return prisma.pollVote.upsert({
    where: { optionId_userId: { optionId, userId } },
    create: { optionId, userId, vote: voteValue },
    update: { vote: voteValue },
  });
}

async function closePoll(userId, groupId, pollId) {
  const [poll, group] = await Promise.all([
    prisma.restaurantPoll.findFirst({ where: { id: pollId, groupId } }),
    prisma.mealGroup.findUnique({ where: { id: groupId }, select: { creatorId: true, name: true } }),
  ]);

  if (!poll) throw new HttpError(404, { error: 'Anket bulunamadı.' });
  if (!group) throw new HttpError(404, { error: 'Grup bulunamadı.' });
  if (poll.creatorId !== userId && group.creatorId !== userId) {
    throw new HttpError(403, { error: 'Sadece anketi oluşturan veya grup kurucusu kapatabilir.' });
  }
  if (poll.status === 'CLOSED') {
    throw new HttpError(400, { error: 'Bu anket zaten kapatılmış.' });
  }

  const closed = await prisma.restaurantPoll.update({
    where: { id: pollId },
    data: { status: 'CLOSED', closedAt: new Date() },
    include: {
      creator: { select: POLL_CREATOR_SELECT },
      options: {
        include: { votes: { include: { user: { select: MEMBER_SELECT } } } },
        orderBy: { addedAt: 'asc' },
      },
    },
  });

  // Kazanan hesabı saf çekirdekte (beraberlikte ilk eklenen kazanır).
  const { winner, maxYes } = computePollWinner(closed.options);

  await notifyOtherMembers(groupId, userId, {
    type: 'MEAL_GROUP_POLL_CLOSED',
    title: 'Anket Sonuçlandı',
    // Hiç YES yoksa kazanan duyurulmaz — "0 oyla kazandı" yanıltıcı olurdu.
    body: winner && maxYes > 0
      ? `"${group.name}" grubunda ${winner.placeName} kazandı!`
      : `"${group.name}" grubundaki anket sonuçlandı`,
    data: { groupId, pollId },
  });

  return { ...closed, winner };
}

async function quickPoll(userId, groupId, { lat, lng, question }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new HttpError(400, { error: 'lat ve lng zorunlu.' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(400, { error: 'Geçersiz koordinat.' });
  }

  await requireAcceptedMembership(groupId, userId, 'Bu grupta anket oluşturamazsınız.');

  const nearby = await getNearbyRestaurantsFast(lat, lng);
  const options = nearby.filter(passesQualityFilter).slice(0, QUICK_POLL_OPTION_COUNT);

  if (options.length < MIN_POLL_OPTIONS) {
    throw new HttpError(422, {
      error: 'Yakınında yeterli restoran bulunamadı. Konumunuzu değiştirip tekrar deneyin.',
    });
  }

  await closeOpenPolls(groupId);

  const poll = await prisma.restaurantPoll.create({
    data: {
      groupId,
      creatorId: userId,
      question: question?.trim() || 'Şu an nereye gidelim?',
      options: {
        create: options.map((place) => ({
          placeId: place.place_id,
          placeName: place.name,
          placeAddress: place.vicinity || null,
          placePhotoUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference, 400) : null,
          placeRating: place.rating || null,
        })),
      },
    },
    include: POLL_INCLUDE,
  });

  const { group, actor } = await loadGroupAndActorNames(groupId, userId);
  await notifyOtherMembers(groupId, userId, {
    type: 'MEAL_GROUP_POLL',
    title: 'Yeni Anket',
    body: `${actor.displayName} "${group.name}" grubunda "Şu an nereye?" anketi başlattı`,
    data: { groupId, pollId: poll.id },
  });

  return poll;
}

module.exports = {
  getMyGroups, getGroup, createGroup, respondToInvite, addMembers,
  createPoll, vote, closePoll, quickPoll,
  requireAcceptedMembership,
  MAX_GROUP_MEMBERS, MAX_POLL_OPTIONS, MIN_POLL_OPTIONS,
};
