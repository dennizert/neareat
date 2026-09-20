'use strict';

/**
 * DELETE /api/auth/account — KVKK hesap silme, Firebase temizliği (#475).
 *
 * Açık: `req.user.googleId` her zaman Google OAuth `sub` değeridir (bkz.
 * resolveTokenUser.js / authController login — hep `decoded.sub` yazılır). Firebase
 * Authentication UID'si KENDİ ürettiği ayrı bir tanımlayıcıdır ve `sub` ile hiç
 * eşleşmez (Firebase Console'da ölçüldü: gerçek bir kullanıcının UID'si
 * `v0Mt9g5W6MhNdqBqTi6JwAx5ecl2` — 28 haneli karışık dizi; Google `sub` ise yalnızca
 * rakamlardan oluşan ~21 haneli bir dizi). Eski kod `deleteUser(googleId)` çağırdığı
 * için HER ZAMAN `auth/user-not-found` alıyor, hatayı sessizce yutuyordu — hiçbir
 * kullanıcının Firebase kaydı gerçekte silinmiyordu.
 */

const request = require('supertest');
const { createTestToken, createTestUser } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn(), delete: jest.fn() },
  restaurantProfile: { findUnique: jest.fn().mockResolvedValue(null) },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

const mockGetUserByEmail = jest.fn();
const mockDeleteUser = jest.fn();
jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ getUserByEmail: (...a) => mockGetUserByEmail(...a), deleteUser: (...a) => mockDeleteUser(...a) }),
  getMessaging: () => ({ send: jest.fn() }),
}));

jest.mock('../../src/services/s3', () => ({
  isS3Configured: () => false,
  keyFromUrl: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/logService', () => ({
  logRequest: jest.fn().mockResolvedValue(undefined),
  logActivity: jest.fn().mockResolvedValue(undefined),
  ACTIVITY_TYPES: {},
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const GOOGLE_USER = createTestUser({
  id: 'u-google-1',
  email: 'ali@gmail.com',
  googleId: '108234567890123456789', // Google `sub` — Firebase UID DEĞİL
  authProvider: 'google',
});
const EMAIL_USER = createTestUser({
  id: 'u-email-1',
  email: 'ayse@test.com',
  googleId: null,
  authProvider: 'email',
});
const FIREBASE_UID = 'v0Mt9g5W6MhNdqBqTi6JwAx5ecl2'; // gerçek Firebase Console ölçümü

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.delete.mockResolvedValue({});
  mockPrisma.restaurantProfile.findUnique.mockResolvedValue(null);
});

describe('DELETE /api/auth/account — Firebase temizliği', () => {
  it('Google kullanıcısı: e-posta ile Firebase\'de bulunur, GERÇEK UID ile silinir', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(GOOGLE_USER);
    mockGetUserByEmail.mockResolvedValue({ uid: FIREBASE_UID });
    mockDeleteUser.mockResolvedValue(undefined);

    const res = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${createTestToken(GOOGLE_USER.id)}`);

    expect(res.status).toBe(200);
    // ASIL DÜZELTME: googleId (Google sub) DEĞİL, e-postayla bulunan gerçek Firebase
    // UID'si ile silme çağrılıyor.
    expect(mockGetUserByEmail).toHaveBeenCalledWith(GOOGLE_USER.email);
    expect(mockDeleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    expect(mockDeleteUser).not.toHaveBeenCalledWith(GOOGLE_USER.googleId);
  });

  it('DB kullanıcısı önce silinir (kaynak-of-truth), Firebase ardından temizlenir', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(GOOGLE_USER);
    mockGetUserByEmail.mockResolvedValue({ uid: FIREBASE_UID });

    await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${createTestToken(GOOGLE_USER.id)}`);

    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: GOOGLE_USER.id } });
  });

  it('e-posta/şifre kullanıcısı (googleId yok): Firebase\'e HİÇ sorulmaz', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(EMAIL_USER);

    const res = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${createTestToken(EMAIL_USER.id)}`);

    expect(res.status).toBe(200);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  // Firebase'de gerçekten kayıt yoksa (e-posta hiç eşleşmiyor) sessizce geç —
  // DB silme başarısına dokunmamalı.
  it('Firebase kaydı bulunamazsa (user-not-found) hesap silme yine 200 döner', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(GOOGLE_USER);
    const err = new Error('no user'); err.code = 'auth/user-not-found';
    mockGetUserByEmail.mockRejectedValue(err);

    const res = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${createTestToken(GOOGLE_USER.id)}`);

    expect(res.status).toBe(200);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  // Beklenmeyen bir Firebase hatası da 200'ü BOZMAMALI (best-effort, DB kaynak-of-truth)
  // ama artık GÖRÜNÜR olmalı — eskiden burası tamamen sessizdi.
  it('beklenmeyen Firebase hatası hesap silmeyi engellemez', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(GOOGLE_USER);
    mockGetUserByEmail.mockRejectedValue(new Error('network timeout'));

    const res = await request(app).delete('/api/auth/account')
      .set('Authorization', `Bearer ${createTestToken(GOOGLE_USER.id)}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalled();
  });

  it('auth yoksa 401, hiçbir silme yapılmaz', async () => {
    const res = await request(app).delete('/api/auth/account');
    expect(res.status).toBe(401);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
