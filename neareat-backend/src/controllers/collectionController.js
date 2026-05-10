const prisma = require('../utils/prisma');
const { isPremiumUser } = require('../utils/premiumCheck');

const FREE_COLLECTION_LIMIT = 0; // Free kullanıcılar koleksiyon oluşturamaz

// ─── Koleksiyon Listesi ───────────────────────────────────────────────────────

// GET /api/collections  — kendi koleksiyonlarım
async function listMyCollections(req, res, next) {
  try {
    const collections = await prisma.collection.findMany({
      where: { userId: req.user.id },
      include: {
        _count: { select: { items: true, shares: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(collections.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isPublic: c.isPublic,
      itemCount: c._count.items,
      shareCount: c._count.shares,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })));
  } catch (err) {
    next(err);
  }
}

// GET /api/collections/shared-with-me  — arkadaşlarımın benimle paylaştıkları
async function listSharedWithMe(req, res, next) {
  try {
    const shares = await prisma.collectionShare.findMany({
      where: { sharedWithId: req.user.id },
      include: {
        collection: {
          include: {
            user: { select: { id: true, displayName: true, photoUrl: true } },
            _count: { select: { items: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(shares.map(s => ({
      shareId: s.id,
      sharedAt: s.createdAt,
      collection: {
        id: s.collection.id,
        name: s.collection.name,
        description: s.collection.description,
        itemCount: s.collection._count.items,
        owner: s.collection.user,
      },
    })));
  } catch (err) {
    next(err);
  }
}

// ─── Tekil Koleksiyon ────────────────────────────────────────────────────────

// GET /api/collections/:id
async function getCollection(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, displayName: true, photoUrl: true } },
        items: { orderBy: { addedAt: 'desc' } },
        shares: {
          include: {
            sharedWith: { select: { id: true, displayName: true, photoUrl: true } },
          },
        },
      },
    });

    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });

    const isOwner = col.userId === req.user.id;
    const isShared = col.shares.some(s => s.sharedWithId === req.user.id);

    if (!isOwner && !isShared && !col.isPublic) {
      return res.status(403).json({ error: 'Bu koleksiyona erişim yetkiniz yok.' });
    }

    res.json({
      id: col.id,
      name: col.name,
      description: col.description,
      isPublic: col.isPublic,
      isOwner,
      owner: col.user,
      items: col.items,
      sharedWith: isOwner ? col.shares.map(s => s.sharedWith) : [],
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// POST /api/collections
async function createCollection(req, res, next) {
  try {
    const premium = await isPremiumUser(req.user.id);
    if (!premium) {
      return res.status(403).json({
        error: 'Koleksiyon oluşturmak Premium üyelik gerektirir.',
        code: 'PREMIUM_REQUIRED',
      });
    }

    const { name, description, isPublic = false } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Koleksiyon adı zorunludur.' });
    }

    const collection = await prisma.collection.create({
      data: {
        userId: req.user.id,
        name: name.trim().slice(0, 100),
        description: description?.trim().slice(0, 300) ?? null,
        isPublic: Boolean(isPublic),
      },
    });

    res.status(201).json({ ...collection, itemCount: 0, shareCount: 0 });
  } catch (err) {
    next(err);
  }
}

// PUT /api/collections/:id
async function updateCollection(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    const { name, description, isPublic } = req.body;
    const updated = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim().slice(0, 100) }),
        ...(description !== undefined && { description: description?.trim().slice(0, 300) ?? null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/collections/:id
async function deleteCollection(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    await prisma.collection.delete({ where: { id: req.params.id } });
    res.json({ message: 'Koleksiyon silindi.' });
  } catch (err) {
    next(err);
  }
}

// ─── Koleksiyon Öğeleri ──────────────────────────────────────────────────────

// POST /api/collections/:id/items
async function addItem(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    const { placeId, placeName, placeAddress, placePhotoUrl, placeRating, note } = req.body;
    if (!placeId || !placeName) {
      return res.status(400).json({ error: 'placeId ve placeName zorunludur.' });
    }

    const item = await prisma.collectionItem.upsert({
      where: { collectionId_placeId: { collectionId: req.params.id, placeId } },
      update: { note: note?.trim().slice(0, 200) ?? null },
      create: {
        collectionId: req.params.id,
        placeId,
        placeName,
        placeAddress: placeAddress ?? null,
        placePhotoUrl: placePhotoUrl ?? null,
        placeRating: placeRating ?? null,
        note: note?.trim().slice(0, 200) ?? null,
      },
    });

    // updatedAt'i güncelle
    await prisma.collection.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/collections/:id/items/:placeId
async function removeItem(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    await prisma.collectionItem.deleteMany({
      where: { collectionId: req.params.id, placeId: req.params.placeId },
    });

    res.json({ message: 'Restoran koleksiyondan kaldırıldı.' });
  } catch (err) {
    next(err);
  }
}

// ─── Paylaşım ────────────────────────────────────────────────────────────────

// POST /api/collections/:id/share/:friendId
async function shareWithFriend(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    const friendId = req.params.friendId;
    if (friendId === req.user.id) {
      return res.status(400).json({ error: 'Koleksiyonu kendinizle paylaşamazsınız.' });
    }

    // Arkadaşlık kontrolü — sadece arkadaşlarla paylaş
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user.id, toUserId: friendId },
          { fromUserId: friendId, toUserId: req.user.id },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) {
      return res.status(403).json({ error: 'Koleksiyonları yalnızca arkadaşlarınızla paylaşabilirsiniz.' });
    }

    const share = await prisma.collectionShare.upsert({
      where: { collectionId_sharedWithId: { collectionId: req.params.id, sharedWithId: friendId } },
      update: {},
      create: { collectionId: req.params.id, sharedWithId: friendId },
    });

    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/collections/:id/share/:friendId
async function unshareWithFriend(req, res, next) {
  try {
    const col = await prisma.collection.findUnique({ where: { id: req.params.id } });
    if (!col) return res.status(404).json({ error: 'Koleksiyon bulunamadı.' });
    if (col.userId !== req.user.id) return res.status(403).json({ error: 'Yetkisiz.' });

    await prisma.collectionShare.deleteMany({
      where: { collectionId: req.params.id, sharedWithId: req.params.friendId },
    });

    res.json({ message: 'Paylaşım kaldırıldı.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/collections/shared-by/:userId — belirli kullanıcının benimle paylaştıkları
async function listSharedByUser(req, res, next) {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;

    // Sadece arkadaşlar için
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: viewerId, toUserId: userId },
          { fromUserId: userId, toUserId: viewerId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) return res.status(403).json({ error: 'Sadece arkadaşların listelerini görebilirsiniz.' });

    const shares = await prisma.collectionShare.findMany({
      where: {
        sharedWithId: viewerId,
        collection: { userId },
      },
      include: {
        collection: {
          include: { _count: { select: { items: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(shares.map(s => ({
      id: s.collection.id,
      name: s.collection.name,
      description: s.collection.description,
      itemCount: s.collection._count.items,
      isPublic: s.collection.isPublic,
      createdAt: s.collection.createdAt,
      updatedAt: s.collection.updatedAt,
    })));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMyCollections,
  listSharedWithMe,
  listSharedByUser,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addItem,
  removeItem,
  shareWithFriend,
  unshareWithFriend,
};
