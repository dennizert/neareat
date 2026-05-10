const prisma = require('../utils/prisma');

async function createNotification(userId, type, title, body, data = null) {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, body, data },
    });
  } catch (err) {
    console.error('[notification] create failed:', err.message);
  }
}

async function createNotificationsForUsers(userIds, type, title, body, data = null) {
  if (!userIds || userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map(userId => ({ userId, type, title, body, data })),
    });
  } catch (err) {
    console.error('[notification] bulk create failed:', err.message);
  }
}

module.exports = { createNotification, createNotificationsForUsers };
