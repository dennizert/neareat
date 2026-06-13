/**
 * AI öneri endpoint controller'ı (Sprint-1 Task #5).
 *
 * POST /api/recommendations/dinner-tonight
 *   body: { lat: number, lng: number, mood?: string }
 *   auth: gerekli (authenticate middleware)
 *
 * Tier mantığı:
 *   - Free → günde 3 öneri (AiRecommendationLog tablosundan sayılır), model = Haiku 4.5
 *   - Premium → limitsiz, model = Sonnet 4.6
 *
 * Limit aşımında: 429 { error: 'LIMIT_EXCEEDED', upgrade: true, resetAt }
 * Aday yoksa: 404 { error: 'NO_CANDIDATES' }
 */

const prisma = require('../utils/prisma');
const { isPremiumUser } = require('../utils/premiumCheck');
const { recommend, recommendStream, recommendForRoute } = require('../services/recommendationService');
const { analyzeRestaurantPhoto } = require('../services/photoAnalysis');
const { cacheGet, cacheSet } = require('../services/redis');

const FREE_DAILY_LIMIT = 1;
const FREE_DAILY_PHOTO_ANALYSIS_LIMIT = 3;
const FEEDBACK_DAILY_LIMIT = 50;

// S16-3 — Premium "sınırsız" AI önerisine maliyet/suistimal freni: günlük tavan.
// 30/gün normal kullanım için pratikte sınırsızdır; yalnızca uç (bot/stres) tüketimi
// keser. 0 → tavan kapalı (gerçekten sınırsız). Free zaten FREE_DAILY_LIMIT ile sınırlı.
const PREMIUM_AI_DAILY_CAP = parseInt(process.env.PREMIUM_AI_DAILY_CAP || '30', 10);

// S16-3 — Kısa süreli öneri yanıt cache'i TTL'i (sn). Aynı kullanıcı + ~1km konum +
// konuşma-bağlamsız (session/refinement yok) tekrar istekte Claude'a HİÇ gidilmez.
const AI_REC_CACHE_TTL = parseInt(process.env.AI_REC_CACHE_TTL || '120', 10);
const MAX_COMMENT_LENGTH = 500;
const MAX_REFINEMENT_LENGTH = 300;

// Mood input validasyonu — controlled vocabulary değil, kullanıcı serbest giriş
// yapabilir ama uzunluk sınırı koyuyoruz. LLM zaten 7-8 örnek mood'u tanıyor.
const MAX_MOOD_LENGTH = 50;

/**
 * İstanbul gece yarısı UTC. "Bugün" hesabı için (TR saati ile günü dönmek istiyoruz).
 * Istanbul UTC+3 sabit (DST yok).
 */
function getIstanbulMidnightUtc() {
  const now = new Date();
  // Istanbul saatine kaydır
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  istanbul.setUTCHours(0, 0, 0, 0); // shifted clock'ta gece yarısı
  // UTC'ye geri çevir
  return new Date(istanbul.getTime() - 3 * 60 * 60 * 1000);
}

/**
 * Sonraki İstanbul gece yarısı — limit reset zamanı.
 */
function getNextIstanbulMidnightUtc() {
  const current = getIstanbulMidnightUtc();
  return new Date(current.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Free kullanıcı için "bugün" yapılan öneri sayısını ver.
 */
async function countTodayCalls(userId) {
  const since = getIstanbulMidnightUtc();
  return prisma.aiRecommendationLog.count({
    where: { userId, requestedAt: { gte: since } },
  });
}

/**
 * S16-3 — Premium kullanıcı günlük tavanı aştı mı? (0 → tavan kapalı.)
 * Tavan iç maliyet/suistimal frenidir; istemciye remaining olarak sızdırılmaz
 * (premium yanıt şekli null kalır), yalnızca aşımda 429 üretilir.
 */
async function premiumCapExceeded(userId) {
  if (PREMIUM_AI_DAILY_CAP <= 0) return false;
  const used = await countTodayCalls(userId);
  return used >= PREMIUM_AI_DAILY_CAP;
}

/**
 * S16-3 — Öneri yanıt cache anahtarı. Yalnızca konuşma-bağlamsız (session/refinement
 * yok) taze istekler cache'lenir; ~1km tile (2 ondalık) + kullanıcı.
 */
function recCacheKey(userId, lat, lng) {
  return `rec-cache:${userId}:${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

async function getDinnerTonight(req, res, next) {
  try {
    const { lat, lng } = req.body || {};

    // Validation
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat ve lng zorunlu (number)' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Geçersiz koordinat' });
    }

    // Tier
    const isPremium = await isPremiumUser(req.user.id);
    let remaining = null;

    // S16-3 — Yanıt cache: aynı kullanıcı + ~1km konumda kısa TTL içinde tekrar
    // istekte Claude'a HİÇ gitme (maliyet + hız). Limit gate'ten önce kontrol edilir
    // ki günlük hakkını kullanmış kullanıcı da cache'lenmiş öneriyi tekrar görebilsin.
    const cacheKey = recCacheKey(req.user.id, lat, lng);
    const cachedRec = await cacheGet(cacheKey);
    if (cachedRec) {
      const usedNow = isPremium ? 0 : await countTodayCalls(req.user.id);
      return res.json({
        ...cachedRec,
        cached: true,
        remainingToday: isPremium ? null : Math.max(0, FREE_DAILY_LIMIT - usedNow),
        resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
      });
    }

    if (!isPremium) {
      const used = await countTodayCalls(req.user.id);
      remaining = Math.max(0, FREE_DAILY_LIMIT - used);
      if (used >= FREE_DAILY_LIMIT) {
        return res.status(429).json({
          error: 'LIMIT_EXCEEDED',
          message:
            'Günlük 1 AI öneri hakkın doldu. Premium\'a geçerek limitsiz öneri al.',
          upgrade: true,
          remaining: 0,
          resetAt: getNextIstanbulMidnightUtc().toISOString(),
        });
      }
    } else if (await premiumCapExceeded(req.user.id)) {
      // S16-3 — premium günlük tavan (maliyet/suistimal freni)
      return res.status(429).json({
        error: 'AI_DAILY_LIMIT',
        message: 'Günlük AI öneri limitine ulaştın, yarın tekrar dene.',
        resetAt: getNextIstanbulMidnightUtc().toISOString(),
      });
    }

    // LLM çağrısı
    const result = await recommend({
      userId: req.user.id,
      location: { lat, lng },
      isPremium,
    });

    // Aday yoksa
    if (result.noCandidates) {
      return res.status(404).json({
        error: 'NO_CANDIDATES',
        message:
          'Şu an yakınında uygun restoran bulamadık. Konum güncellemeyi dene veya biraz uzaklaş.',
      });
    }

    // Free tier remaining decrement (call başarılı oldu, log yazıldı)
    if (!isPremium) {
      remaining = Math.max(0, remaining - 1);
    }

    // Response shaping — frontend'in beklediği {restaurant, reason} yapısı
    const recommendations = result.recommendations.map((r) => ({
      placeId: r.placeId,
      reason: r.reason,
      neverVisited: r.neverVisited ?? false,
      restaurant: {
        name: r.candidate.name,
        types: r.candidate.types,
        rating: r.candidate.rating,
        userRatingsTotal: r.candidate.userRatingsTotal,
        priceLevel: r.candidate.priceLevel,
        vicinity: r.candidate.vicinity,
        location: r.candidate.location,
        distanceKm: r.candidate.distanceKm,
        openNow: r.candidate.openNow,
        photoUrl: r.candidate.photoUrl ?? null,
        isRegistered: r.candidate.isRegistered ?? false,
      },
    }));

    // S16-3 — başarılı öneriyi kısa TTL ile cache'le (fire-and-forget). Volatile
    // alanlar (remaining/resetAt/latency) cache dışı; hit'te tazece eklenir.
    const cachePayload = {
      recommendations,
      noteToUser: result.noteToUser,
      tier: result.tier,
      model: result.model,
    };
    cacheSet(cacheKey, cachePayload, AI_REC_CACHE_TTL).catch(() => {});

    return res.json({
      ...cachePayload,
      remainingToday: isPremium ? null : remaining,
      resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * SSE yardımcı — tek event satırı yazar.
 */
function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * POST /api/recommendations/dinner-tonight/stream
 * SSE endpoint — her kart hazır olduğunda data: event gönderir.
 * Mevcut /dinner-tonight endpoint'i silinmez — backward compat için kalır.
 */
async function getDinnerTonightStream(req, res, next) {
  let keepAlive = null;
  try {
    const { lat, lng, sessionId, refinement } = req.body || {};

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat ve lng zorunlu (number)' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Geçersiz koordinat' });
    }
    // Konuşmaya dayalı refinement (Sprint-4 Task #2) — opsiyonel
    if (sessionId != null && typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId string olmalı' });
    }
    let trimmedRefinement = null;
    if (refinement != null) {
      if (typeof refinement !== 'string') {
        return res.status(400).json({ error: 'refinement string olmalı' });
      }
      trimmedRefinement = refinement.trim().slice(0, MAX_REFINEMENT_LENGTH) || null;
    }

    // SSE headers — sonraki her yazma istemciye uçar
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // İlk chunk'ı hemen gönder — proxy chunked streaming'i başlatır, client bağlı kalır
    res.write(': ping\n\n');

    const isPremium = await isPremiumUser(req.user.id);
    let remaining = null;

    // S16-3 — Yanıt cache (yalnızca konuşma-bağlamsız taze istek: session+refinement
    // yok). Hit'te Claude'a gitmeden kartları replay edip bitir. Limit gate'inden ÖNCE
    // kontrol edilir ki günlük hakkını kullanmış kullanıcı da kısa TTL içinde aynı
    // öneriyi maliyetsiz tekrar görebilsin.
    const cacheable = !sessionId && !trimmedRefinement;
    const cacheKey = cacheable ? recCacheKey(req.user.id, lat, lng) : null;
    if (cacheKey) {
      const cachedRec = await cacheGet(cacheKey);
      if (cachedRec?.cards?.length) {
        const usedNow = isPremium ? 0 : await countTodayCalls(req.user.id);
        for (const recommendation of cachedRec.cards) sseWrite(res, { type: 'card', recommendation });
        if (cachedRec.noteToUser) sseWrite(res, { type: 'note', noteToUser: cachedRec.noteToUser });
        sseWrite(res, {
          type: 'done',
          sessionId: null,
          tier: cachedRec.tier,
          model: cachedRec.model,
          remainingToday: isPremium ? null : Math.max(0, FREE_DAILY_LIMIT - usedNow),
          resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
          latencyMs: 0,
          cached: true,
        });
        res.end();
        return;
      }
    }

    if (!isPremium) {
      const used = await countTodayCalls(req.user.id);
      remaining = Math.max(0, FREE_DAILY_LIMIT - used);
      if (used >= FREE_DAILY_LIMIT) {
        sseWrite(res, {
          type: 'error',
          code: 'LIMIT_EXCEEDED',
          message: 'Günlük 1 AI öneri hakkın doldu. Premium\'a geçerek limitsiz öneri al.',
          upgrade: true,
          resetAt: getNextIstanbulMidnightUtc().toISOString(),
        });
        res.end();
        return;
      }
    } else if (await premiumCapExceeded(req.user.id)) {
      // S16-3 — premium günlük tavan (maliyet/suistimal freni)
      sseWrite(res, {
        type: 'error',
        code: 'AI_DAILY_LIMIT',
        message: 'Günlük AI öneri limitine ulaştın, yarın tekrar dene.',
        resetAt: getNextIstanbulMidnightUtc().toISOString(),
      });
      res.end();
      return;
    }

    // Proxy idle-timeout'u önlemek için her 8 sn bir SSE comment satırı gönder.
    // Railway proxy'si ~10-12 sn idle timeout uygular; 8 sn ping bunu aşıyor.
    keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 8_000);

    // Client bağlantıyı koparırsa stream durdur
    const abortRef = { abort: null };
    req.on('close', () => {
      clearInterval(keepAlive);
      if (abortRef.abort) abortRef.abort();
    });

    // S16-3 — yanıt cache için kartları/notu biriktir (yalnızca cacheable istekte yazılır)
    const collectedCards = [];
    let collectedNote = null;

    const result = await recommendStream({
      userId: req.user.id,
      location: { lat, lng },
      isPremium,
      abortRef,
      sessionId: sessionId ?? null,
      refinement: trimmedRefinement,
      onCard: (recommendation) => {
        collectedCards.push(recommendation);
        sseWrite(res, { type: 'card', recommendation });
      },
      onNote: (noteToUser) => {
        collectedNote = noteToUser;
        sseWrite(res, { type: 'note', noteToUser });
      },
      onDone: ({ tier, model, latencyMs, sessionId: sid }) => {
        clearInterval(keepAlive);
        if (!isPremium) remaining = Math.max(0, remaining - 1);
        // S16-3 — başarılı öneriyi kısa TTL ile cache'le (cacheable + kart varsa)
        if (cacheKey && collectedCards.length) {
          cacheSet(cacheKey, { cards: collectedCards, noteToUser: collectedNote, tier, model }, AI_REC_CACHE_TTL).catch(() => {});
        }
        sseWrite(res, {
          type: 'done',
          sessionId: sid,
          tier,
          model,
          remainingToday: isPremium ? null : remaining,
          resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
          latencyMs,
        });
        res.end();
      },
    });

    if (result?.noCandidates) {
      clearInterval(keepAlive);
      sseWrite(res, {
        type: 'error',
        code: 'NO_CANDIDATES',
        message: 'Şu an yakınında uygun restoran bulamadık. Konum güncellemeyi dene veya biraz uzaklaş.',
      });
      res.end();
    }
  } catch (err) {
    if (keepAlive) clearInterval(keepAlive);
    if (!res.headersSent) {
      next(err);
    } else {
      sseWrite(res, { type: 'error', message: err.message || 'Internal server error' });
      res.end();
    }
  }
}

/**
 * Kullanıcının bugün verdiği feedback sayısını say (anti-spam).
 */
async function countTodayFeedback(userId) {
  const since = getIstanbulMidnightUtc();
  return prisma.recommendationFeedback.count({
    where: { userId, createdAt: { gte: since } },
  });
}

/**
 * POST /api/recommendations/feedback
 * body: { placeId, sentiment, aiRecommendationLogId?, comment?, visited? }
 */
async function postFeedback(req, res, next) {
  try {
    const { placeId, sentiment, aiRecommendationLogId, comment, visited, placeTypes } = req.body || {};

    // Validation
    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'placeId zorunlu (string)' });
    }
    if (sentiment !== 'positive' && sentiment !== 'negative') {
      return res.status(400).json({
        error: 'sentiment "positive" veya "negative" olmalı',
      });
    }
    let trimmedComment = null;
    if (comment != null) {
      if (typeof comment !== 'string') {
        return res.status(400).json({ error: 'comment string olmalı' });
      }
      trimmedComment = comment.trim().slice(0, MAX_COMMENT_LENGTH) || null;
    }
    if (visited != null && typeof visited !== 'boolean') {
      return res.status(400).json({ error: 'visited boolean olmalı' });
    }
    // placeTypes opsiyonel — mutfak tipi aggregate'i için (S4-7). String dizisi, max 10.
    let cleanedTypes = [];
    if (placeTypes != null) {
      if (!Array.isArray(placeTypes)) {
        return res.status(400).json({ error: 'placeTypes string dizisi olmalı' });
      }
      cleanedTypes = placeTypes
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim().toLowerCase())
        .slice(0, 10);
    }

    // Anti-spam rate limit
    const todayCount = await countTodayFeedback(req.user.id);
    if (todayCount >= FEEDBACK_DAILY_LIMIT) {
      return res.status(429).json({
        error: 'FEEDBACK_LIMIT_EXCEEDED',
        message: 'Günlük feedback limitine ulaştın.',
        resetAt: getNextIstanbulMidnightUtc().toISOString(),
      });
    }

    const feedback = await prisma.recommendationFeedback.create({
      data: {
        userId: req.user.id,
        placeId,
        sentiment,
        aiRecommendationLogId: aiRecommendationLogId ?? null,
        comment: trimmedComment,
        visited: typeof visited === 'boolean' ? visited : false,
        placeTypes: cleanedTypes,
      },
    });

    return res.status(201).json({ id: feedback.id, sentiment, placeId });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/recommendations/route-tonight
 * body: { originLat, originLng, destLat, destLng, mood? }
 * Rota üzerindeki en iyi 1-3 restoranı önerir.
 * Aynı günlük sayacı /dinner-tonight ile paylaşır (free: 1/gün).
 */
async function getRouteTonightRecommendation(req, res, next) {
  try {
    const { originLat, originLng, destLat, destLng, departureTime } = req.body || {};

    if (
      typeof originLat !== 'number' || typeof originLng !== 'number' ||
      typeof destLat !== 'number' || typeof destLng !== 'number'
    ) {
      return res.status(400).json({ error: 'originLat, originLng, destLat, destLng zorunlu (number)' });
    }
    if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90) {
      return res.status(400).json({ error: 'lat değerleri −90..90 arasında olmalı' });
    }
    if (originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
      return res.status(400).json({ error: 'lng değerleri −180..180 arasında olmalı' });
    }
    // departureTime: optional ISO date string
    let validDepartureTime = null;
    if (departureTime != null) {
      if (typeof departureTime !== 'string') {
        return res.status(400).json({ error: 'departureTime string (ISO) olmalı' });
      }
      const t = new Date(departureTime).getTime();
      if (isNaN(t)) {
        return res.status(400).json({ error: 'departureTime geçerli bir tarih olmalı' });
      }
      validDepartureTime = departureTime;
    }

    const isPremium = await isPremiumUser(req.user.id);
    let remaining = null;

    if (!isPremium) {
      const used = await countTodayCalls(req.user.id);
      remaining = Math.max(0, FREE_DAILY_LIMIT - used);
      if (used >= FREE_DAILY_LIMIT) {
        return res.status(429).json({
          error: 'LIMIT_EXCEEDED',
          message: 'Günlük 1 AI öneri hakkın doldu. Premium\'a geçerek limitsiz öneri al.',
          upgrade: true,
          remaining: 0,
          resetAt: getNextIstanbulMidnightUtc().toISOString(),
        });
      }
    } else if (await premiumCapExceeded(req.user.id)) {
      // S16-3 — premium günlük tavan (maliyet/suistimal freni)
      return res.status(429).json({
        error: 'AI_DAILY_LIMIT',
        message: 'Günlük AI öneri limitine ulaştın, yarın tekrar dene.',
        resetAt: getNextIstanbulMidnightUtc().toISOString(),
      });
    }

    const result = await recommendForRoute({
      userId: req.user.id,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      departureTime: validDepartureTime,
      isPremium,
    });

    if (result.noRoute) {
      return res.status(404).json({
        error: 'NO_ROUTE_FOUND',
        message: 'Verilen koordinatlar arasında rota bulunamadı.',
      });
    }

    if (result.noCandidates) {
      return res.status(404).json({
        error: 'NO_CANDIDATES',
        message: 'Rota boyunca uygun restoran bulamadık.',
      });
    }

    if (!isPremium) {
      remaining = Math.max(0, remaining - 1);
    }

    const recommendations = result.recommendations.map((r, i) => ({
      placeId: r.placeId,
      reason: r.reason,
      restaurant: {
        name: r.candidate.name,
        types: r.candidate.types,
        rating: r.candidate.rating,
        userRatingsTotal: r.candidate.userRatingsTotal,
        priceLevel: r.candidate.priceLevel,
        vicinity: r.candidate.vicinity,
        location: r.candidate.location,
        distanceKm: r.candidate.distanceKm,
        openNow: r.candidate.openNow,
        photoUrl: r.candidate.photoUrl ?? null,
        isRegistered: r.candidate.isRegistered ?? false,
        sequenceOrder: i + 1,
        detourKm: r.detourKm ?? null,
        openAtArrival: r.openAtArrival ?? null,
      },
    }));

    return res.json({
      recommendations,
      noteToUser: result.noteToUser,
      totalRouteDistanceKm: result.totalRouteDistanceKm,
      totalRouteDurationMin: result.totalRouteDurationMin,
      tier: result.tier,
      model: result.model,
      remainingToday: isPremium ? null : remaining,
      resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    next(err);
  }
}

// Sprint-7 #94 — POST /api/recommendations/analyze-photo
// Body: { imageUrl?, imageBase64?, mediaType?, placeId?, placeName?, placeAddress? }
// Premium: limitsiz. Free: 3/gün (Redis sayacı; rec quota'sından bağımsız).
function photoAnalysisCacheKey(userId) {
  // Türkiye günlük key
  const turkey = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const date = turkey.toISOString().slice(0, 10);
  return `photo-analyze:${userId}:${date}`;
}

async function analyzePhoto(req, res, next) {
  try {
    const { imageUrl, imageBase64, mediaType, placeId, placeName, placeAddress } = req.body || {};

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'imageUrl ya da imageBase64 gerekli' });
    }
    if (imageBase64 && typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 string olmalı' });
    }

    const isPremium = await isPremiumUser(req.user.id);
    let remaining = null;
    if (!isPremium) {
      const key = photoAnalysisCacheKey(req.user.id);
      const used = Number(await cacheGet(key)) || 0;
      if (used >= FREE_DAILY_PHOTO_ANALYSIS_LIMIT) {
        return res.status(429).json({
          error: 'LIMIT_EXCEEDED',
          upgrade: true,
          remainingToday: 0,
          resetAt: getNextIstanbulMidnightUtc().toISOString(),
        });
      }
      // Önce sayacı artır (race condition önlemi); başarısızsa rollback'e gerek yok,
      // kullanıcı bir slot kaybeder ama paralel paniklemez.
      await cacheSet(key, used + 1, 26 * 60 * 60);
      remaining = Math.max(0, FREE_DAILY_PHOTO_ANALYSIS_LIMIT - (used + 1));
    }

    const result = await analyzeRestaurantPhoto({
      imageUrl,
      imageBase64,
      mediaType,
      placeId,
      placeName,
      placeAddress,
    });

    res.json({
      analysis: result.analysis,
      model: result.model,
      fallback: result.fallback,
      remainingToday: isPremium ? null : remaining,
      resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDinnerTonight,
  getDinnerTonightStream,
  getRouteTonightRecommendation,
  postFeedback,
  analyzePhoto,
  // testable internals
  __test: {
    FREE_DAILY_LIMIT,
    FEEDBACK_DAILY_LIMIT,
    MAX_MOOD_LENGTH,
    MAX_COMMENT_LENGTH,
    MAX_REFINEMENT_LENGTH,
    countTodayCalls,
    countTodayFeedback,
    getIstanbulMidnightUtc,
    getNextIstanbulMidnightUtc,
  },
};
