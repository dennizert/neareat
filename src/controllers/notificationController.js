const prisma = require('../utils/prisma');
const { getMessaging } = require('../services/firebase');

async function updateFcmToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken },
    });

    res.json({ message: 'FCM token updated' });
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  res.json({ message: 'Preferences updated' });
}

async function sendPushToUser(userId, title, body) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.fcmToken) return;

  await getMessaging().send({
    token: user.fcmToken,
    notification: { title, body },
  });
}

module.exports = { updateFcmToken, updatePreferences, sendPushToUser };
