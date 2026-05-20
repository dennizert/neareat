const prisma = require('../utils/prisma');
const { containsOffensiveContent } = require('../utils/contentFilter');
const { logRequest } = require('../services/logService');

const USER_SELECT = {
  id: true, displayName: true, photoUrl: true,
};

// ─── Konuşma listesi ──────────────────────────────────────────────────────────

// GET /api/messages/conversations
async function getConversations(req, res, next) {
  try {
    const userId = req.user.id;

    // Kullanıcının mesaj geçmişi olan her kullanıcı ile son mesajı al
    const sent = await prisma.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, content: true, createdAt: true, isRead: true,
        senderId: true, receiverId: true,
        receiver: { select: USER_SELECT },
      },
    });

    const received = await prisma.message.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, content: true, createdAt: true, isRead: true,
        senderId: true, receiverId: true,
        sender: { select: USER_SELECT },
      },
    });

    // Her benzersiz conversation için son mesajı bul
    const convMap = new Map();

    for (const m of sent) {
      const otherId = m.receiverId;
      if (!convMap.has(otherId) || m.createdAt > convMap.get(otherId).lastMessage.createdAt) {
        convMap.set(otherId, {
          userId: otherId,
          profile: m.receiver,
          lastMessage: { content: m.content, createdAt: m.createdAt, isRead: m.isRead, isMine: true },
          unreadCount: 0,
        });
      }
    }

    for (const m of received) {
      const otherId = m.senderId;
      const existing = convMap.get(otherId);
      if (!existing || m.createdAt > existing.lastMessage.createdAt) {
        convMap.set(otherId, {
          userId: otherId,
          profile: m.sender,
          lastMessage: { content: m.content, createdAt: m.createdAt, isRead: m.isRead, isMine: false },
          unreadCount: (existing?.unreadCount ?? 0) + (!m.isRead ? 1 : 0),
        });
      } else if (!m.isRead) {
        existing.unreadCount = (existing.unreadCount ?? 0) + 1;
      }
    }

    // Unread counts — doğru hesaplama için
    const unreadCounts = await prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false },
      _count: { id: true },
    });
    const unreadMap = new Map(unreadCounts.map(u => [u.senderId, u._count.id]));
    for (const [otherId, conv] of convMap.entries()) {
      conv.unreadCount = unreadMap.get(otherId) ?? 0;
    }

    const conversations = [...convMap.values()].sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
    );

    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

// ─── Belirli kullanıcıyla mesajlar ───────────────────────────────────────────

// GET /api/messages/:userId?cursor=&limit=
async function getMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const otherId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit ?? '30'), 50);
    const cursor = req.query.cursor; // message id for pagination

    // Sadece arkadaşlarla mesajlaşılabilir
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherId },
          { fromUserId: otherId, toUserId: userId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) return res.status(403).json({ error: 'Sadece arkadaşlarınızla mesajlaşabilirsiniz.' });

    const where = {
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    };

    const [messages, otherUser] = await Promise.all([
      prisma.message.findMany({
        where: cursor ? { ...where, id: { lt: cursor } } : where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, content: true, isRead: true, createdAt: true,
          senderId: true, receiverId: true,
        },
      }),
      prisma.user.findUnique({ where: { id: otherId }, select: USER_SELECT }),
    ]);

    // Okunmamış mesajları okundu işaretle
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    res.json({
      messages: messages.reverse(),
      otherUser,
      hasMore: messages.length === limit,
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Mesaj gönder ─────────────────────────────────────────────────────────────

// POST /api/messages/:userId  { content }
async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const otherId = req.params.userId;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Mesaj içeriği boş olamaz.' });
    if (content.trim().length > 2000) return res.status(400).json({ error: 'Mesaj en fazla 2000 karakter olabilir.' });
    if (otherId === userId) return res.status(400).json({ error: 'Kendinize mesaj gönderemezsiniz.' });
    if (containsOffensiveContent(content)) {
      return res.status(400).json({ error: 'Mesajınız uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' });
    }

    // Sadece arkadaşlarla mesajlaşılabilir
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherId },
          { fromUserId: otherId, toUserId: userId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) return res.status(403).json({ error: 'Sadece arkadaşlarınızla mesajlaşabilirsiniz.' });

    const message = await prisma.message.create({
      data: { senderId: userId, receiverId: otherId, content: content.trim() },
      select: { id: true, content: true, isRead: true, createdAt: true, senderId: true, receiverId: true },
    });

    logRequest({ req, page: 'Mesajlar', action: 'Mesaj gönderdi', details: otherId }).catch(() => {});
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// ─── Okunmamış mesaj sayısı ───────────────────────────────────────────────────

// GET /api/messages/unread-count
async function getUnreadCount(req, res, next) {
  try {
    const count = await prisma.message.count({
      where: { receiverId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

module.exports = { getConversations, getMessages, sendMessage, getUnreadCount };
