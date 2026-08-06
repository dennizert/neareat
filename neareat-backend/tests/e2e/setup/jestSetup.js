'use strict';

/**
 * E2E paketi — her test dosyası için ortak kurulum.
 *
 * Burada yapılan iki iş var:
 *  1. Dış servisleri (yalnızca onları) sahteleriyle değiştirmek. `jest.mock` çağrıları
 *     `setupFilesAfterEnv` içinde test dosyasının modül kaydına uygulanır, böylece her
 *     yolculuk testi bunları tekrar yazmak zorunda kalmaz.
 *  2. Her testten önce veritabanını boşaltmak — testler birbirinin verisini görmemeli.
 */

const externals = require('./externals');

// ─── Dış servisler ───────────────────────────────────────────────────────────

// E-posta: susturulmaz, YAKALANIR. Doğrulama/şifre sıfırlama yolculukları gönderilen
// maildeki token'a ihtiyaç duyar — gerçek kullanıcının linke tıklaması gibi.
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(async (payload) => {
        require('./externals').outbox.emails.push(payload);
        return { data: { id: `email-${Date.now()}` }, error: null };
      }),
    },
  })),
}));

// Google Places: testin senaryoya göre ayarladığı sahte yerler döner.
jest.mock('../../../src/services/googlePlaces', () => {
  const actual = jest.requireActual('../../../src/services/googlePlaces');
  const ext = require('./externals');
  return {
    ...actual, // passesQualityFilter, cuisine/freshness yardımcıları GERÇEK kalsın
    getNearbyRestaurants: jest.fn(async () => ext.places.nearby),
    getNearbyRestaurantsFast: jest.fn(async () => ext.places.nearby),
    searchPlacesByText: jest.fn(async () => ext.places.nearby),
    getPlaceDetails: jest.fn(async () => ext.places.details),
    getRouteWaypoints: jest.fn(async () => null),
    getPhotoUrl: jest.fn((ref) => (ref ? `https://photos.test/${ref}` : null)),
  };
});

// Anthropic SDK: sabit, ayarlanabilir bir öneri yanıtı.
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(async () => {
        const ext = require('./externals');
        return {
          id: 'msg_e2e',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          content: [{
            type: 'text',
            text: JSON.stringify({
              recommendations: ext.ai.recommendations,
              noteToUser: ext.ai.noteToUser,
            }),
          }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        };
      }),
    },
  }));
});

// Firebase: Google girişi doğrulaması — token'ın içinden sabit bir kimlik üretir.
jest.mock('../../../src/services/firebase', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn(async (token) => ({
      uid: `firebase-${token}`,
      email: `${token}@google.test`,
      name: 'Google Kullanıcı',
    })),
    deleteUser: jest.fn(async () => undefined),
  }),
}));

jest.mock('../../../src/services/googleAuth', () => ({
  verifyGoogleIdToken: jest.fn(async (token) => ({
    sub: `google-${token}`,
    email: `${token}@google.test`,
    name: 'Google Kullanıcı',
    picture: null,
  })),
}));

// S3: yapılandırılmamış kabul edilir — foto yükleme uçları 503 ile net yanıt verir.
jest.mock('../../../src/services/s3', () => ({
  isS3Configured: () => false,
  keyFromUrl: () => null,
  createUploadUrl: jest.fn(),
  getObjectSize: jest.fn(),
  deleteObject: jest.fn(),
  ALLOWED_CONTENT_TYPES: { 'image/jpeg': true, 'image/png': true, 'image/webp': true },
}));

// ─── Veritabanı izolasyonu ───────────────────────────────────────────────────

const prisma = require('../../../src/utils/prisma');
const { resetDatabase } = require('./database');

beforeEach(async () => {
  await resetDatabase(prisma);
  externals.reset();
});

afterAll(async () => {
  await prisma.$disconnect();
});
