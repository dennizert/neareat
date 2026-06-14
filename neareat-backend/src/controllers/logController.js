// Admin kullanıcı aktivite logları (UserLog) için sorgu/listeleme controller'ı.
const prisma = require('../utils/prisma');

// GET /api/logs?email=&startDate=&endDate=&startTime=&endTime=&page=1&limit=50
// Admin paneli AdminLogsScreen'in e-posta + tarih/saat aralığı filtreli, sayfalı log listesi.
async function getLogs(req, res, next) {
  try {
    const { email, startDate, endDate, startTime, endTime, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // E-posta filtresi: büyük/küçük harf duyarsız kısmi eşleşme.
    if (email) {
      where.email = { contains: email.trim(), mode: 'insensitive' };
    }

    // Tarih + opsiyonel saat alanlarını UTC aralık sınırlarına çevir (gün başı/sonu varsayılan).
    const createdAt = {};
    if (startDate) {
      createdAt.gte = new Date(`${startDate}T${startTime || '00:00'}:00.000Z`);
    }
    if (endDate) {
      createdAt.lte = new Date(`${endDate}T${endTime || '23:59'}:59.999Z`);
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }

    // Sayfa verisi + toplam sayıyı paralel çek (sayfalama meta'sı için).

    const [logs, total] = await Promise.all([
      prisma.userLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          userId: true,
          username: true,
          email: true,
          page: true,
          action: true,
          details: true,
          ip: true,
          createdAt: true,
        },
      }),
      prisma.userLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLogs };
