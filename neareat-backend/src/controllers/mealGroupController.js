const prisma = require('../utils/prisma');
const { createNotification } = require('../services/notificationService');
const { logRequest } = require('../services/logService');
const { getNearbyRestaurantsFast, getPhotoUrl, passesQualityFilter } = require('../services/googlePlaces');

const MEMBER_SELECT = { id: true, displayName: true, photoUrl: true };

// GET /api/meal-groups
async function getMyGroups(req, res, next) {
  try {
    const userId = req.user.id;

    const memberships = await prisma.mealGroupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            creator: { select: MEMBER_SELECT },
            members: {
              include: { user: { select: MEMBER_SELECT } },
            },
            polls: {
              where: { status: 'OPEN' },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groups = memberships.map((m) => ({
      ...m.group,
      myStatus: m.status,
      hasOpenPoll: m.group.polls.length > 0,
      polls: undefined,
    }));

    res.json(groups);
  } catch (err) {
    next(err);
  }
}

// GET /api/meal-groups/:id
async function getGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const membership = await prisma.mealGroupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (!membership) return res.status(403).json({ error: 'Bu gruba erişim yetkiniz yok.' });

    const group = await prisma.mealGroup.findUnique({
      where: { id },
      include: {
        creator: { select: MEMBER_SELECT },
        members: {
          include: { user: { select: MEMBER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
        polls: {
          include: {
            creator: { select: { id: true, displayName: true } },
            options: {
              include: {
                votes: {
                  include: { user: { select: MEMBER_SELECT } },
                },
              },
              orderBy: { addedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!group) return res.status(404).json({ error: 'Grup bulunamadı.' });

    res.json({ ...group, myStatus: membership.status });
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups
async function createGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, memberIds = [] } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Grup adı zorunlu.' });
    if (name.trim().length > 100) return res.status(400).json({ error: 'Grup adı en fazla 100 karakter olabilir.' });
    if (!Array.isArray(memberIds)) return res.status(400).json({ error: 'Geçersiz üye listesi.' });
    if (memberIds.length > 19) return res.status(400).json({ error: 'Bir gruba en fazla 20 üye eklenebilir.' });

    // null/undefined değerleri filtrele (Prisma 6.x in:[] hata verir)
    const safeIds = memberIds.filter((id) => typeof id === 'string' && id.length > 0);

    let validMemberIds = [];
    if (safeIds.length > 0) {
      const friends = await prisma.friendRequest.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { fromUserId: userId, toUserId: { in: safeIds } },
            { toUserId: userId, fromUserId: { in: safeIds } },
          ],
        },
        select: { fromUserId: true, toUserId: true },
      });
      const friendIds = new Set(friends.map((f) => (f.fromUserId === userId ? f.toUserId : f.fromUserId)));
      validMemberIds = [...new Set(safeIds.filter((id) => friendIds.has(id)))];
    }

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

    logRequest({ req, page: 'Gruplar', action: 'Grup oluşturdu', details: group.id }).catch(() => {});

    res.status(201).json({ ...group, myStatus: 'ACCEPTED', hasOpenPoll: false });
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:id/respond
async function respondToInvite(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: groupId } = req.params;
    const { status } = req.body;

    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum. ACCEPTED veya DECLINED olmalı.' });
    }

    const membership = await prisma.mealGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== 'INVITED') {
      return res.status(404).json({ error: 'Bekleyen davet bulunamadı.' });
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

    logRequest({ req, page: 'Gruplar', action: `Grup davetine ${status === 'ACCEPTED' ? 'katıldı' : 'reddetti'}`, details: groupId }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:id/polls
async function createPoll(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: groupId } = req.params;
    const { question, options = [] } = req.body;

    const membership = await prisma.mealGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bu grupta anket oluşturamazsınız.' });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'En az 2 restoran seçeneği ekleyin.' });
    }
    if (options.length > 8) {
      return res.status(400).json({ error: 'En fazla 8 seçenek eklenebilir.' });
    }
    for (const opt of options) {
      if (!opt.placeId || !opt.placeName) {
        return res.status(400).json({ error: 'Her seçenek placeId ve placeName içermelidir.' });
      }
    }

    // Önceki açık anketi kapat
    await prisma.restaurantPoll.updateMany({
      where: { groupId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

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
      include: {
        creator: { select: { id: true, displayName: true } },
        options: { include: { votes: { include: { user: { select: MEMBER_SELECT } } } } },
      },
    });

    // Üyelere bildirim gönder
    const [members, group, creator] = await Promise.all([
      prisma.mealGroupMember.findMany({ where: { groupId, status: 'ACCEPTED', userId: { not: userId } }, select: { userId: true } }),
      prisma.mealGroup.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    ]);

    for (const m of members) {
      createNotification(
        m.userId,
        'MEAL_GROUP_POLL',
        'Yeni Anket',
        `${creator.displayName} "${group.name}" grubunda yeni bir anket başlattı`,
        { groupId, pollId: poll.id },
      ).catch(() => {});
    }

    logRequest({ req, page: 'Gruplar', action: 'Anket oluşturdu', details: groupId }).catch(() => {});

    res.status(201).json(poll);
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:groupId/polls/:pollId/vote
async function vote(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId, pollId } = req.params;
    const { optionId, vote: voteValue } = req.body;

    if (!['YES', 'NO', 'MAYBE'].includes(voteValue)) {
      return res.status(400).json({ error: 'Geçersiz oy. YES, NO veya MAYBE olmalı.' });
    }

    const [membership, poll, option] = await Promise.all([
      prisma.mealGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } } }),
      prisma.restaurantPoll.findUnique({ where: { id: pollId } }),
      prisma.pollOption.findFirst({ where: { id: optionId, pollId } }),
    ]);

    if (!membership || membership.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bu grupta oy kullanamazsınız.' });
    }
    if (!poll || poll.groupId !== groupId || poll.status !== 'OPEN') {
      return res.status(400).json({ error: 'Bu anket artık aktif değil.' });
    }
    if (!option) return res.status(404).json({ error: 'Seçenek bulunamadı.' });

    const result = await prisma.pollVote.upsert({
      where: { optionId_userId: { optionId, userId } },
      create: { optionId, userId, vote: voteValue },
      update: { vote: voteValue },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:groupId/polls/:pollId/close
async function closePoll(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId, pollId } = req.params;

    const [poll, group] = await Promise.all([
      prisma.restaurantPoll.findFirst({ where: { id: pollId, groupId } }),
      prisma.mealGroup.findUnique({ where: { id: groupId }, select: { creatorId: true, name: true } }),
    ]);

    if (!poll) return res.status(404).json({ error: 'Anket bulunamadı.' });
    if (!group) return res.status(404).json({ error: 'Grup bulunamadı.' });
    if (poll.creatorId !== userId && group.creatorId !== userId) {
      return res.status(403).json({ error: 'Sadece anketi oluşturan veya grup kurucusu kapatabilir.' });
    }
    if (poll.status === 'CLOSED') {
      return res.status(400).json({ error: 'Bu anket zaten kapatılmış.' });
    }

    const closed = await prisma.restaurantPoll.update({
      where: { id: pollId },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: {
        creator: { select: { id: true, displayName: true } },
        options: {
          include: { votes: { include: { user: { select: MEMBER_SELECT } } } },
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    // YES oyuna göre kazananı hesapla
    let winner = null;
    let maxYes = -1;
    for (const opt of closed.options) {
      const yesCount = opt.votes.filter((v) => v.vote === 'YES').length;
      if (yesCount > maxYes) { maxYes = yesCount; winner = opt; }
    }

    // Tüm üyelere bildir
    const members = await prisma.mealGroupMember.findMany({
      where: { groupId, status: 'ACCEPTED', userId: { not: userId } },
      select: { userId: true },
    });
    for (const m of members) {
      createNotification(
        m.userId,
        'MEAL_GROUP_POLL_CLOSED',
        'Anket Sonuçlandı',
        winner && maxYes > 0
          ? `"${group.name}" grubunda ${winner.placeName} kazandı!`
          : `"${group.name}" grubundaki anket sonuçlandı`,
        { groupId, pollId },
      ).catch(() => {});
    }

    logRequest({ req, page: 'Gruplar', action: 'Anketi kapattı', details: pollId }).catch(() => {});

    res.json({ ...closed, winner });
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:id/members
async function addMembers(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: groupId } = req.params;
    const { memberIds = [] } = req.body;

    // Grupta ACCEPTED üye olmalı
    const membership = await prisma.mealGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bu gruba üye ekleyemezsiniz.' });
    }

    const safeIds = (Array.isArray(memberIds) ? memberIds : []).filter(
      (id) => typeof id === 'string' && id.length > 0,
    );
    if (safeIds.length === 0) return res.status(400).json({ error: 'Eklenecek üye belirtilmedi.' });

    // Sadece arkadaşları ekleyebilir
    const friends = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: userId, toUserId: { in: safeIds } },
          { toUserId: userId, fromUserId: { in: safeIds } },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    });
    const friendIds = new Set(friends.map((f) => (f.fromUserId === userId ? f.toUserId : f.fromUserId)));
    const validIds = [...new Set(safeIds.filter((id) => friendIds.has(id)))];
    if (validIds.length === 0) return res.status(400).json({ error: 'Seçilenler arasında arkadaşınız bulunamadı.' });

    // Zaten üye olanları atla (upsert yerine createMany skipDuplicates)
    await prisma.mealGroupMember.createMany({
      data: validIds.map((id) => ({ groupId, userId: id, status: 'INVITED' })),
      skipDuplicates: true,
    });

    // Davet bildirimleri
    const [group, inviter] = await Promise.all([
      prisma.mealGroup.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    ]);
    for (const memberId of validIds) {
      createNotification(
        memberId,
        'MEAL_GROUP_INVITE',
        'Grup Daveti',
        `${inviter.displayName} seni "${group.name}" grubuna davet etti`,
        { groupId },
      ).catch(() => {});
    }

    logRequest({ req, page: 'Gruplar', action: 'Gruba üye ekledi', details: groupId }).catch(() => {});

    // Güncel grup bilgisini döndür
    const updated = await prisma.mealGroup.findUnique({
      where: { id: groupId },
      include: {
        creator: { select: MEMBER_SELECT },
        members: { include: { user: { select: MEMBER_SELECT } }, orderBy: { createdAt: 'asc' } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /api/meal-groups/:id/quick-poll
async function quickPoll(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: groupId } = req.params;
    const { lat, lng, question } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat ve lng zorunlu.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Geçersiz koordinat.' });
    }

    const membership = await prisma.mealGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== 'ACCEPTED') {
      return res.status(403).json({ error: 'Bu grupta anket oluşturamazsınız.' });
    }

    const nearby = await getNearbyRestaurantsFast(lat, lng);
    const options = nearby.filter(passesQualityFilter).slice(0, 5);

    if (options.length < 2) {
      return res.status(422).json({ error: 'Yakınında yeterli restoran bulunamadı. Konumunuzu değiştirip tekrar deneyin.' });
    }

    // Önceki açık anketi kapat
    await prisma.restaurantPoll.updateMany({
      where: { groupId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

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
            placePhotoUrl: place.photos?.[0]
              ? getPhotoUrl(place.photos[0].photo_reference, 400)
              : null,
            placeRating: place.rating || null,
          })),
        },
      },
      include: {
        creator: { select: { id: true, displayName: true } },
        options: { include: { votes: { include: { user: { select: MEMBER_SELECT } } } } },
      },
    });

    const [members, group, creator] = await Promise.all([
      prisma.mealGroupMember.findMany({
        where: { groupId, status: 'ACCEPTED', userId: { not: userId } },
        select: { userId: true },
      }),
      prisma.mealGroup.findUnique({ where: { id: groupId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    ]);

    for (const m of members) {
      createNotification(
        m.userId,
        'MEAL_GROUP_POLL',
        'Yeni Anket',
        `${creator.displayName} "${group.name}" grubunda "Şu an nereye?" anketi başlattı`,
        { groupId, pollId: poll.id },
      ).catch(() => {});
    }

    logRequest({ req, page: 'Gruplar', action: 'Hızlı anket başlattı', details: groupId }).catch(() => {});

    res.status(201).json(poll);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyGroups, getGroup, createGroup, respondToInvite, addMembers, createPoll, vote, closePoll, quickPoll };
