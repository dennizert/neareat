/**
 * Test setup — her test suite'inden önce çalışır.
 * Gerçek DB ve Redis yerine mock'lar kullanır.
 */

// JWT_SECRET test ortamı için set et
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.NODE_ENV = 'test';
process.env.FREE_RADIUS_KM = '5';
process.env.PREMIUM_RADIUS_KM = '25';
process.env.TRIAL_DAYS = '7';
process.env.FREE_FAVORITES_LIMIT = '5';
process.env.REDIS_NEARBY_TTL = '3600';
process.env.REDIS_PLACE_DETAILS_TTL = '86400';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg==\n-----END PRIVATE KEY-----\n';
