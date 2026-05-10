const prisma = require('../utils/prisma');
const { awardStars } = require('../utils/stars');

async function verifyReviewOwnership(reviewId, userId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  return (!review || review.userId !== userId) ? null : review;
}

async function getReviews(req, res, next) {
  try {
    const { placeId } = req.params;
    const reviews = await prisma.review.findMany({
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
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

async function createReview(req, res, next) {
  try {
    const { placeId, rating, body, placeName } = req.body;
    if (!placeId || !rating || !body) {
      return res.status(400).json({ error: 'placeId, rating, body required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be 1-5' });
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

    res.status(201).json({ review, starEvent, newStarCount, newRewards });
  } catch (err) {
    next(err);
  }
}

async function updateReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { rating, body } = req.body;

    const review = await verifyReviewOwnership(reviewId, req.user.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { rating, body },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const review = await verifyReviewOwnership(reviewId, req.user.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReviews, createReview, updateReview, deleteReview };
