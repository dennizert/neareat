const prisma = require('../utils/prisma');
const { awardStars } = require('../utils/stars');
const { containsOffensiveContent } = require('../utils/contentFilter');
const { logRequest, logActivity, ACTIVITY_TYPES } = require('../services/logService');

// Yorumun var olduğunu VE çağıran kullanıcıya ait olduğunu doğrular (yoksa null).
// update/delete'te IDOR'u önlemek için ortak kontrol — başkasının yorumu düzenlenemez.
async function verifyReviewOwnership(reviewId, userId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  return (!review || review.userId !== userId) ? null : review;
}

// Bir mekanın yorumlarını (yazar + restoran yanıtı dahil) en yeni önce döner.
// S14-B6: cursor-bazlı sayfalama. Popüler mekanlarda tüm yorumları tek seferde dönmek
// yanıtı şişirir; `?limit=&cursor=` ile sayfalanır.
//   - Sayfalama parametresi YOKSA: geriye uyumlu DÜZ DİZİ döner (eski mobil sözleşmesi),
//     varsayılan limitle sınırlı.
//   - `limit`/`cursor` VARSA: { reviews, hasMore, nextCursor } döner.
const REVIEWS_DEFAULT_LIMIT = 50;
const REVIEWS_MAX_LIMIT = 100;

async function getReviews(req, res, next) {
  try {
    const { placeId } = req.params;
    const paginated = req.query.limit != null || req.query.cursor != null;
    const limit = Math.min(parseInt(req.query.limit ?? String(REVIEWS_DEFAULT_LIMIT), 10) || REVIEWS_DEFAULT_LIMIT, REVIEWS_MAX_LIMIT);
    const cursor = req.query.cursor;

    const rows = await prisma.review.findMany({
      where: { placeId },
      include: {
        user: { select: { displayName: true, photoUrl: true } },
        reply: {
          select: {
            id: true, content: true, createdAt: true, updatedAt: true,
            restaurant: { select: { businessName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // hasMore tespiti için bir fazla çek
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const reviews = hasMore ? rows.slice(0, limit) : rows;

    if (!paginated) return res.json(reviews); // geriye uyumlu düz dizi
    res.json({
      reviews,
      hasMore,
      nextCursor: hasMore ? reviews[reviews.length - 1].id : null,
    });
  } catch (err) {
    next(err);
  }
}

// Yorum oluşturur/günceller (kullanıcı+mekan başına tek yorum → upsert). İçerik filtresinden
// geçirir (küfür/hakaret reddi). Yalnızca İLK yorumda yıldız ödülü + sosyal aktivite olayı
// üretir (güncellemede tekrar ödül/spam yok).
async function createReview(req, res, next) {
  try {
    // placeId/rating(1-5)/body validasyonu validate(reviewCreateSchema) middleware'inde (S14-B2).
    const { placeId, rating, body, placeName } = req.body;
    if (containsOffensiveContent(body)) {
      return res.status(400).json({ error: 'Yorumunuz uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' });
    }

    const existing = await prisma.review.findUnique({
      where: { userId_placeId: { userId: req.user.id, placeId } },
    });

    const review = await prisma.review.upsert({
      where: { userId_placeId: { userId: req.user.id, placeId } },
      update: { rating, body },
      create: { userId: req.user.id, placeId, rating, body },
      include: { user: { select: { displayName: true, photoUrl: true } } },
    });

    let starEvent = null;
    let newStarCount = null;
    let newRewards = [];
    if (!existing) {
      const label = placeName || placeId;
      const result = await awardStars(req.user.id, 'REVIEW', `${label} için yorum yazdın`, review.id);
      starEvent = result.event;
      newStarCount = result.newStarCount;
      newRewards = result.newRewards;
    }

    const action = existing ? 'Yorumunu güncelledi' : 'Yorum yazdı';
    logRequest({ req, page: 'Restoran Detay', action, details: placeName || placeId }).catch(() => {});
    // Sosyal aktivite akışı — yalnızca YENİ yorum (güncellemede spam olmasın)
    if (!existing) {
      logActivity({
        userId: req.user.id,
        type: ACTIVITY_TYPES.REVIEW,
        placeId,
        metadata: { placeName: placeName || null, rating },
      });
    }
    res.status(201).json({ review, starEvent, newStarCount, newRewards });
  } catch (err) {
    next(err);
  }
}

// Kullanıcının kendi yorumunu günceller (sahiplik + içerik filtresi kontrolüyle).
async function updateReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { rating, body } = req.body;

    const review = await verifyReviewOwnership(reviewId, req.user.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (body && containsOffensiveContent(body)) {
      return res.status(400).json({ error: 'Yorumunuz uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { rating, body },
    });
    logRequest({ req, page: 'Restoran Detay', action: 'Yorumunu güncelledi', details: review.placeId }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Kullanıcının kendi yorumunu siler (sahiplik kontrolüyle). Admin silmesi ayrı uçta.
async function deleteReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const review = await verifyReviewOwnership(reviewId, req.user.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    logRequest({ req, page: 'Restoran Detay', action: 'Yorumunu sildi', details: review.placeId }).catch(() => {});
    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReviews, createReview, updateReview, deleteReview };
