const prisma = require('../utils/prisma');

async function logRequest({ req, page, action, details }) {
  try {
    const user = req?.user;
    const forwarded = req?.headers?.['x-forwarded-for'];
    const ip = (forwarded ? forwarded.split(',')[0].trim() : null) || req?.ip || null;

    await prisma.userLog.create({
      data: {
        userId: user?.id || null,
        username: user?.displayName || null,
        email: user?.email || null,
        page,
        action,
        details: details ? String(details).substring(0, 500) : null,
        ip,
      },
    });
  } catch (err) {
    console.error('[logService] error:', err.message);
  }
}

module.exports = { logRequest };
