'use strict';

/**
 * restaurantAccountService birim testleri (S22-1).
 *
 * Bu dosyanın asıl kanıtı şu: iş mantığı artık `req`/`res` OLMADAN, Express ayağa
 * kaldırılmadan çağrılabiliyor ve test edilebiliyor. Refactor öncesi bu kuralları
 * doğrulamak için tüm HTTP akışını kurmak gerekiyordu.
 *
 * Davranış korunumunun asıl kapısı mevcut integration testleridir (değiştirilmeden yeşil);
 * burada iş kurallarının kendisi izole olarak sabitlenir.
 */

jest.mock('../../../src/utils/prisma', () => ({
  restaurantProfile: { findUnique: jest.fn(), update: jest.fn() },
  restaurantMenu: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  restaurantPhoto: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
  review: { findUnique: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  reviewReply: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  reservation: { findMany: jest.fn() },
  favorite: { findMany: jest.fn(), count: jest.fn() },
  collectionItem: { findMany: jest.fn() },
  recommendation: { count: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../src/utils/premiumCheck', () => ({ isRestaurantActive: jest.fn() }));
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  createNotificationsForUsers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/businessReport', () => ({ generateWeeklyReport: jest.fn() }));
jest.mock('../../../src/services/s3', () => ({
  isS3Configured: jest.fn(() => false),
  keyFromUrl: jest.fn(() => null),
  createUploadUrl: jest.fn(),
  getObjectSize: jest.fn(),
  deleteObject: jest.fn(),
  ALLOWED_CONTENT_TYPES: { 'image/jpeg': true },
}));

const prisma = require('../../../src/utils/prisma');
const { isRestaurantActive } = require('../../../src/utils/premiumCheck');
const { createNotificationsForUsers } = require('../../../src/services/notificationService');
const svc = require('../../../src/services/restaurantAccountService');
const { HttpError } = require('../../../src/utils/httpError');

const USER_ID = 'u-1';

beforeEach(() => {
  jest.clearAllMocks();
  isRestaurantActive.mockResolvedValue(true);
});

/** Bir servis çağrısının HttpError ile ve beklenen statü/gövdeyle reddettiğini doğrular. */
async function expectHttpError(promise, status, bodyMatch) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(status);
  if (bodyMatch) expect(err.body).toMatchObject(bodyMatch);
  return err;
}

describe('abonelik kapısı (S19-1)', () => {
  it.each([
    ['getAnalytics', () => svc.getAnalytics(USER_ID)],
    ['getWeeklyReport', () => svc.getWeeklyReport(USER_ID)],
    ['getOccupancy', () => svc.getOccupancy(USER_ID, '2026-08-06')],
    ['sendCampaign', () => svc.sendCampaign(USER_ID, { message: 'merhaba dünya' })],
    ['activateInstantDiscount', () => svc.activateInstantDiscount(USER_ID, { durationMinutes: 60, percent: 10 })],
  ])('%s pasif abonelikte 403 SUBSCRIPTION_REQUIRED döner', async (_name, call) => {
    isRestaurantActive.mockResolvedValue(false);
    await expectHttpError(call(), 403, { code: 'SUBSCRIPTION_REQUIRED' });
  });

  it('updateInfo: rezervasyon AÇMA abonelik ister, KAPATMA serbesttir', async () => {
    isRestaurantActive.mockResolvedValue(false);
    await expectHttpError(
      svc.updateInfo(USER_ID, { acceptsReservations: true }),
      403,
      { code: 'SUBSCRIPTION_REQUIRED' },
    );

    prisma.restaurantProfile.update.mockResolvedValue({ id: 'p1' });
    await expect(svc.updateInfo(USER_ID, { acceptsReservations: false })).resolves.toEqual({ id: 'p1' });
  });

  it('addPhoto: PRODUCT abonelik ister, RESTAURANT serbesttir', async () => {
    isRestaurantActive.mockResolvedValue(false);
    await expectHttpError(
      svc.addPhoto(USER_ID, { kind: 'PRODUCT', url: 'https://x/y.jpg' }),
      403,
      { code: 'SUBSCRIPTION_REQUIRED' },
    );

    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.restaurantPhoto.count.mockResolvedValue(0);
    prisma.restaurantPhoto.create.mockResolvedValue({ id: 'ph1' });
    await expect(svc.addPhoto(USER_ID, { kind: 'RESTAURANT', url: 'https://x/y.jpg' }))
      .resolves.toEqual({ id: 'ph1' });
  });
});

describe('updateInfo — kapasite validasyonu', () => {
  it.each([
    ['tableCount', { tableCount: 0 }, 'Masa kapasitesi 1-500 arasında olmalıdır.'],
    ['tableCount', { tableCount: 501 }, 'Masa kapasitesi 1-500 arasında olmalıdır.'],
    ['seatCapacity', { seatCapacity: 0 }, 'Koltuk kapasitesi 1-5000 arasında olmalıdır.'],
    ['seatCapacity', { seatCapacity: 5001 }, 'Koltuk kapasitesi 1-5000 arasında olmalıdır.'],
  ])('%s sınır dışı değeri reddeder', async (_n, input, message) => {
    await expectHttpError(svc.updateInfo(USER_ID, input), 400, { error: message });
  });

  it('geçerli koltuk kapasitesi kaydedilir', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({ seatCapacity: 40 });
    await svc.updateInfo(USER_ID, { seatCapacity: 40 });
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ seatCapacity: 40 }) }),
    );
  });

  it('displayName boş string gönderilirse null olur (Google adına döner)', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({});
    await svc.updateInfo(USER_ID, { displayName: '   ' });
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: null }) }),
    );
  });
});

describe('sendCampaign — günde 1 kampanya limiti', () => {
  const approved = {
    id: 'p1', placeId: 'place-1', placeName: 'Test', businessName: 'Test AŞ',
    status: 'APPROVED', lastCampaignAt: null,
  };

  it('bugün gönderilmişse 429 CAMPAIGN_LIMIT_EXCEEDED', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ ...approved, lastCampaignAt: new Date() });
    await expectHttpError(
      svc.sendCampaign(USER_ID, { message: 'kampanya mesajı' }),
      429,
      { error: 'CAMPAIGN_LIMIT_EXCEEDED' },
    );
  });

  it('onaylı olmayan restoran kampanya gönderemez', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ ...approved, status: 'PENDING' });
    await expectHttpError(svc.sendCampaign(USER_ID, { message: 'kampanya mesajı' }), 403);
  });

  it('başarılı gönderimde alıcı sayısı döner ve lastCampaignAt damgalanır', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue(approved);
    prisma.favorite.findMany.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]);
    prisma.reservation.findMany.mockResolvedValue([{ userId: 'b' }, { userId: USER_ID }]);
    prisma.restaurantProfile.update.mockResolvedValue({});

    const result = await svc.sendCampaign(USER_ID, { message: 'kampanya mesajı' });

    // a + b tekilleştirildi; kendisi (USER_ID) hariç tutuldu.
    expect(result).toEqual({ sent: 2, audience: 'all' });
    expect(createNotificationsForUsers).toHaveBeenCalledTimes(1);
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastCampaignAt: expect.any(Date) }) }),
    );
  });

  it.each(['ab', ''])('çok kısa mesaj (%s) reddedilir', async (message) => {
    await expectHttpError(svc.sendCampaign(USER_ID, { message }), 400);
  });

  it('geçersiz audience reddedilir', async () => {
    await expectHttpError(svc.sendCampaign(USER_ID, { message: 'kampanya mesajı', audience: 'nope' }), 400);
  });
});

describe('menü yükleme sınırları', () => {
  it('10 öğe doluysa yeni yükleme reddedilir', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.restaurantMenu.count.mockResolvedValue(10);
    await expectHttpError(
      svc.uploadMenuItem(USER_ID, { data: 'AAAA', mimeType: 'image/png' }),
      400,
      { error: 'En fazla 10 menü öğesi yükleyebilirsiniz' },
    );
  });

  it('desteklenmeyen dosya türü reddedilir', async () => {
    await expectHttpError(
      svc.uploadMenuItem(USER_ID, { data: 'AAAA', mimeType: 'application/zip' }),
      400,
      { error: 'Desteklenmeyen dosya türü' },
    );
  });

  it('3 MB üstü base64 reddedilir', async () => {
    const tooBig = 'A'.repeat(5 * 1024 * 1024);
    await expectHttpError(
      svc.uploadMenuItem(USER_ID, { data: tooBig, mimeType: 'image/png' }),
      400,
      { error: 'Menü dosyası en fazla 3 MB olabilir.' },
    );
  });
});

describe('sahiplik kontrolleri', () => {
  it('başka restorana ait menü öğesi silinemez', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.restaurantMenu.findUnique.mockResolvedValue({ id: 'm1', restaurantId: 'BASKA' });
    await expectHttpError(svc.deleteMenuItem(USER_ID, 'm1'), 404);
    expect(prisma.restaurantMenu.delete).not.toHaveBeenCalled();
  });

  it('başka restorana ait fotoğraf silinemez', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.restaurantPhoto.findUnique.mockResolvedValue({ id: 'ph1', restaurantProfileId: 'BASKA' });
    await expectHttpError(svc.deletePhoto(USER_ID, 'ph1'), 404);
    expect(prisma.restaurantPhoto.delete).not.toHaveBeenCalled();
  });

  it('onaylı olmayan restoran yoruma cevap veremez', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'p1', status: 'PENDING' });
    await expectHttpError(svc.replyToReview(USER_ID, 'r1', { content: 'teşekkürler' }), 403);
  });
});

describe('getStats — placeId yoksa sıfır değerler', () => {
  it('profil yoksa sıfırlarla döner (hata değil)', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue(null);
    await expect(svc.getStats(USER_ID)).resolves.toEqual({
      favorites: 0, reviews: 0, avgRating: null, recommendations: 0,
    });
  });
});

describe('getTurkeyDayStartUtc', () => {
  it('Türkiye gününün başlangıcını UTC olarak verir', () => {
    const start = svc.getTurkeyDayStartUtc();
    expect(start).toBeInstanceOf(Date);
    // TR günü UTC+3'te başlar → UTC saati 21:00 (önceki gün) olmalı.
    expect(start.getUTCHours()).toBe(21);
  });
});
