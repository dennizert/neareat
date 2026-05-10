require('dotenv').config();

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
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Railway / reverse proxy arkasında X-Forwarded-For'a güven
app.set('trust proxy', 1);

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
}));

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
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

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NearEat API → http://0.0.0.0:${PORT}  (ağdan: http://192.168.1.117:${PORT})`);
});

module.exports = app;
