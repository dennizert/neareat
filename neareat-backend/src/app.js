require('dotenv').config();
const prisma = require('./utils/prisma');
const { getRedis } = require('./services/redis');

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const placesRoutes = require('./routes/places');
const searchHistoryRoutes = require('./routes/searchHistory');
const checkinRoutes = require('./routes/checkin');
const diaryRoutes = require('./routes/diary');
const favoriteRoutes = require('./routes/favorites');
const reviewRoutes = require('./routes/reviews');
const subscriptionRoutes = require('./routes/subscriptions');
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
const profileRoutes = require('./routes/profile');
const socialRoutes = require('./routes/social');
const collectionRoutes = require('./routes/collections');
const restaurantAccountRoutes = require('./routes/restaurantAccount');
const adminRoutes = require('./routes/admin');
const reservationRoutes = require('./routes/reservations');
const logRoutes = require('./routes/logs');
const mealGroupRoutes = require('./routes/mealGroups');
const recommendationRoutes = require('./routes/recommendations');
const referralRoutes = require('./routes/referral');
const errorHandler = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');
const sanitize = require('./middleware/sanitize');
const { scheduleReservationReminders } = require('./jobs/reservationReminders');
const { scheduleSmartNotifications } = require('./jobs/smartNotifications');
const { scheduleFeedbackAggregation } = require('./jobs/feedbackAggregator');
const { scheduleFriendSuggestions } = require('./jobs/friendSuggestions');

const app = express();

// Railway / reverse proxy arkasında X-Forwarded-For'a güven
app.set('trust proxy', 1);

// ─── İstek izleme — tüm diğer middleware'lerden önce ────────────────────────
app.use(requestId);

// ─── Güvenlik başlıkları ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,          // REST API, HTML serve etmiyor
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Mobil istemciler
  hsts: {
    maxAge: 31536000,                    // 1 yıl HTTPS zorlaması
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'no-referrer' },
  noSniff: true,
  frameguard: { action: 'deny' },
}));

// CORS: React Native mobil istemciler Origin header göndermez, web erişimini kısıtla
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Origin yoksa → native mobil istek, izin ver
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS policy: bu origin\'e izin verilmiyor'));
  },
  credentials: true,
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit-User', 'X-RateLimit-Remaining-User'],
}));

// ─── HTTP loglama (request ID dahil) ────────────────────────────────────────
morgan.token('id', (req) => req.id);
const morganFormat = process.env.NODE_ENV === 'production'
  ? ':id :remote-addr :method :url :status :res[content-length] - :response-time ms'
  : ':id :method :url :status - :response-time ms';
app.use(morgan(morganFormat));

// Auth endpoint'leri için sıkı rate limiting (brute force koruması)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi, 15 dakika sonra tekrar deneyin' },
});

// Genel API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi, lütfen bekleyin' },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Auth endpoint'leri küçük body, profil/fotoğraf yüklemeleri büyük olabilir
app.use('/api/auth', express.json({ limit: '10kb' }));
app.use(express.json({ limit: '5mb' }));

// ─── Input sanitizasyonu — body parse'dan hemen sonra ───────────────────────
app.use(sanitize);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisOk = await getRedis().ping().catch(() => null);
    res.json({ status: 'ok', db: true, redis: !!redisOk, uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', db: false, error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/search-history', searchHistoryRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/restaurant-account', restaurantAccountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/meal-groups', mealGroupRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/referral', referralRoutes);

// Email linklerinden gelen deep link yönlendirmeleri
// Email istemcileri neareat:// şemasını bloke eder; HTTPS link → deep link
app.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token eksik');
  res.redirect(`neareat://verify-email?token=${encodeURIComponent(token)}`);
});

app.get('/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token eksik');
  res.redirect(`neareat://reset-password?token=${encodeURIComponent(token)}`);
});

app.use(errorHandler);

// Jest paralel worker'ları aynı app.js'i require ettiğinde port 3000 çakışmasın diye
// (ve cron'lar test ortamında schedule olmasın diye) listen + shutdown'ı test modunda atla.
// supertest, request(app) ile kendi geçici portunu açtığı için listen'a ihtiyaç duymaz.
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`NearEat API → http://0.0.0.0:${PORT}  (ağdan: http://192.168.1.117:${PORT})`);
    scheduleReservationReminders();
    scheduleSmartNotifications();
    scheduleFeedbackAggregation();
    scheduleFriendSuggestions();
  });

  // Graceful shutdown — açık bağlantıları düzgün kapat
  function gracefulShutdown(signal) {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        const redis = getRedis();
        if (redis.status === 'ready') await redis.quit();
      } catch { /* ignore */ }
      console.log('Server closed');
      process.exit(0);
    });
    // 10 saniye içinde kapanmazsa zorla kapat
    setTimeout(() => process.exit(1), 10000);
  }
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
