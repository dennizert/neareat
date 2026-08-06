const prisma = require('../utils/prisma');
const { containsOffensiveContent } = require('../utils/contentFilter');
const { logRequest } = require('../services/logService');
const { PUBLIC_USER_SELECT } = require('../utils/userDto'); // S21-1

// Konuşma muhatabı kartı — ortak public kullanıcı projeksiyonu (tek kaynak: utils/userDto).
const USER_SELECT = PUBLIC_USER_SELECT;

// ─── Konuşma listesi ──────────────────────────────────────────────────────────

// GET /api/messages/conversations
async function getConversations(req, res, next) {
  try {
    const userId = req.user.id;

    // Konuşma başına yalnızca SON mesajı çek — tüm mesaj geçmişini belleğe
    // yüklemeden. DISTINCT ON (other_id) ile her "karşı kullanıcı" için en yeni
    // mesaj satırı alınır. (Eskiden tüm gönderilen+alınan mesajlar çekilip JS'te
    // dedupe ediliyordu; mesaj sayısı arttıkça ölçeklenmiyordu.)
    const lastMessages = await prisma.$queryRaw`
      SELECT DISTINCT ON (other_id)
        other_id    AS "otherId",
        id,
        content,
        created_at  AS "createdAt",
        is_read     AS "isRead",
        sender_id   AS "senderId"
      FROM (
        SELECT
          CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS other_id,
          id, content, created_at, is_read, sender_id
        FROM messages
        WHERE sender_id = ${userId} OR receiver_id = ${userId}
      ) sub
      ORDER BY other_id, created_at DESC
    `;

    if (lastMessages.length === 0) return res.json([]);

    // Karşı kullanıcıların profillerini tek sorguda al (konuşma sayısı kadar — sınırlı)
    const otherIds = lastMessages.map((m) => m.otherId);
    const profiles = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: USER_SELECT,
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Okunmamış sayıları (gönderen başına) — verimli groupBy
    const unreadCounts = await prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false },
      _count: { id: true },
    });
    const unreadMap = new Map(unreadCounts.map((u) => [u.senderId, u._count.id]));

    const conversations = lastMessages
      .map((m) => ({
        userId: m.otherId,
        profile: profileMap.get(m.otherId) || null,
        lastMessage: {
          content: m.content,
          createdAt: m.createdAt,
          isRead: m.isRead,
          isMine: m.senderId === userId,
        },
        unreadCount: unreadMap.get(m.otherId) ?? 0,
      }))
      .sort(
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
