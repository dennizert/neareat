'use strict';

/**
 * reservationService birim testleri (S23-1).
 *
 * Bu controller, kod tabanındaki en yoğun iş kuralı kesişimiydi. Testler refactor sırasında
 * sessizce bozulabilecek kuralları hedefler: S18-2 seviye kotası, S19-3 overbooking uyarısı
 * (metin BİREBİR), S19-4 öncelik sıralaması + starCount sızmaması, ve katılım/no-show
 * yıldız etkileri.
 */

jest.mock('../../../src/utils/prisma', () => ({
  reservation: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  restaurantProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
  reservationMessage: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../src/utils/levelAccess', () => ({ getUserAccess: jest.fn(), getLevelAccess: jest.fn() }));
jest.mock('../../../src/utils/stars', () => ({
  awardStars: jest.fn().mockResolvedValue({}),
  deductStars: jest.fn().mockResolvedValue({}),
  getLevel: jest.fn(),
  RESERVATION_NO_SHOW_PENALTY: 10,
}));
jest.mock('../../../src/services/referralReward', () => ({ maybeAwardReferrer: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/services/logService', () => ({ logActivity: jest.fn(), ACTIVITY_TYPES: { RESERVATION: 'RESERVATION' } }));
jest.mock('../../../src/utils/restaurantVisibility', () => ({ registeredProfileWhere: (base) => base }));

const prisma = require('../../../src/utils/prisma');
const { getUserAccess, getLevelAccess } = require('../../../src/utils/levelAccess');
const { awardStars, deductStars, getLevel } = require('../../../src/utils/stars');
const { maybeAwardReferrer } = require('../../../src/services/referralReward');
const svc = require('../../../src/services/reservationService');
const { OVERBOOKING_WARNING } = require('../../../src/utils/reservationPolicy');
const { HttpError } = require('../../../src/utils/httpError');

const ACTOR = { id: 'u-1', displayName: 'Deniz' };

/** Bugünden 30 gün sonrası — geçmiş-tarih doğrulamasına takılmasın. */
function futureDate() {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
const FUTURE = futureDate();

const VALID_INPUT = { placeId: 'p1', date: FUTURE, time: '20:00', guestCount: 4 };

beforeEach(() => {
  jest.clearAllMocks();
  getUserAccess.mockResolvedValue({ access: { maxReservationsPerMonth: null } });
  getLevelAccess.mockReturnValue({ reservationPriority: 0 });
  getLevel.mockReturnValue({ level: 1 });
  prisma.reservation.count.mockResolvedValue(0);
  prisma.reservation.findFirst.mockResolvedValue(null);
  prisma.reservation.findMany.mockResolvedValue([]);
  prisma.restaurantProfile.findFirst.mockResolvedValue({
    id: 'r1', businessName: 'Test AŞ', userId: 'owner-1', placeName: 'Test', tableCount: null, seatCapacity: null,
  });
  prisma.reservation.create.mockResolvedValue({ id: 'res-1', placeName: 'Test' });
});

async function expectHttpError(promise, status, bodyMatch) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(status);
  if (bodyMatch) expect(err.body).toMatchObject(bodyMatch);
  return err;
}

describe('S18-2 seviye kotası', () => {
  it('L1: ilk rezervasyon serbest', async () => {
    getUserAccess.mockResolvedValue({ access: { maxReservationsPerMonth: 0 } });
    prisma.reservation.count.mockResolvedValue(0);
    await expect(svc.createReservation(ACTOR, VALID_INPUT)).resolves.toMatchObject({ id: 'res-1' });
  });

  it('L1: ikinci rezervasyonda 403 LEVEL_REQUIRED (requiredLevel 2)', async () => {
    getUserAccess.mockResolvedValue({ access: { maxReservationsPerMonth: 0 } });
    prisma.reservation.count.mockResolvedValue(1);
    await expectHttpError(svc.createReservation(ACTOR, VALID_INPUT), 403, {
      code: 'LEVEL_REQUIRED', requiredLevel: 2, feature: 'reservation',
    });
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });

  it('L2: ay içindeki kota dolduğunda 403 (requiredLevel 3)', async () => {
    getUserAccess.mockResolvedValue({ access: { maxReservationsPerMonth: 1 } });
    prisma.reservation.count.mockResolvedValue(1);
    await expectHttpError(svc.createReservation(ACTOR, VALID_INPUT), 403, {
      code: 'LEVEL_REQUIRED', requiredLevel: 3,
    });
  });

  it('L3+: sınırsız — kota sorgusu bile yapılmaz', async () => {
    getUserAccess.mockResolvedValue({ access: { maxReservationsPerMonth: null } });
    await svc.createReservation(ACTOR, VALID_INPUT);
    // Kota için count çağrılmaz (yalnızca kapasite/çakışma yolları çağırabilir).
    expect(prisma.reservation.create).toHaveBeenCalled();
  });
});

describe('S19-3 overbooking uyarısı', () => {
  it('yetersiz kapasitede talep YİNE oluşur ve uyarı eklenir', async () => {
    prisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r1', businessName: 'Test AŞ', userId: 'owner-1', placeName: 'Test', tableCount: null, seatCapacity: 10,
    });
    // Dolu: 10 koltuk kapasitede 10 koltuk CONFIRMED
    prisma.reservation.findMany.mockResolvedValue([{ time: '20:00', guestCount: 10, reservedSeats: 10 }]);

    const result = await svc.createReservation(ACTOR, VALID_INPUT);

    expect(prisma.reservation.create).toHaveBeenCalled(); // talep oluşturuldu
    expect(result.warning).toBe('OVERBOOKING');
    // Mesaj mobil (S19-6) tarafından gösteriliyor — BİREBİR aynı kalmalı.
    expect(result.message).toBe(
      'Restoranda talebinize uygun yer kalmamıştır. Talebiniz oluşturulmuştur, restoran planlama yapabilirse onaylanacaktır. Aksi halde reddedilecektir.',
    );
  });

  it('yeterli kapasitede uyarı YOK', async () => {
    prisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r1', businessName: 'Test AŞ', userId: 'owner-1', placeName: 'Test', tableCount: null, seatCapacity: 100,
    });
    prisma.reservation.findMany.mockResolvedValue([]);

    const result = await svc.createReservation(ACTOR, VALID_INPUT);
    expect(result).not.toHaveProperty('warning');
  });

  it('kapasite tanımsızsa kontrol hiç yapılmaz', async () => {
    const result = await svc.createReservation(ACTOR, VALID_INPUT);
    expect(result).not.toHaveProperty('warning');
  });

  it('uyarı sabiti donmuş (yanlışlıkla değiştirilemez)', () => {
    expect(Object.isFrozen(OVERBOOKING_WARNING)).toBe(true);
  });
});

describe('oluşturma — doğrulama ve çakışma', () => {
  it.each([
    // Not: guestCount=0 falsy olduğu için aralık kontrolünden ÖNCE "zorunlu alan"
    // kontrolüne takılır — mevcut davranış, olduğu gibi korundu.
    [{ ...VALID_INPUT, guestCount: 0 }, 'placeId, date, time ve guestCount zorunludur.'],
    [{ ...VALID_INPUT, guestCount: 51 }, 'Misafir sayısı 1-50 arasında olmalıdır.'],
    [{ ...VALID_INPUT, date: '06-08-2026' }, 'Tarih YYYY-MM-DD formatında olmalıdır.'],
    [{ ...VALID_INPUT, time: '20.00' }, 'Saat HH:MM formatında olmalıdır.'],
  ])('geçersiz girdi reddedilir', async (input, message) => {
    await expectHttpError(svc.createReservation(ACTOR, input), 400, { error: message });
  });

  it('geçmiş tarih reddedilir', async () => {
    await expectHttpError(
      svc.createReservation(ACTOR, { ...VALID_INPUT, date: '2020-01-01' }),
      400,
      { error: 'Geçmiş bir tarih veya saate rezervasyon yapılamaz.' },
    );
  });

  it('aynı gün/saatte aktif rezervasyon varsa 409', async () => {
    prisma.reservation.findFirst.mockResolvedValue({ id: 'mevcut' });
    await expectHttpError(svc.createReservation(ACTOR, VALID_INPUT), 409);
  });

  it('saat dilimi tableCount ile doluysa 409', async () => {
    prisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r1', businessName: 'T', userId: 'o', placeName: 'T', tableCount: 2, seatCapacity: null,
    });
    prisma.reservation.count.mockResolvedValue(2);
    await expectHttpError(svc.createReservation(ACTOR, VALID_INPUT), 409);
  });

  it('rezervasyona kapalı restoranda 400', async () => {
    prisma.restaurantProfile.findFirst.mockResolvedValue(null);
    await expectHttpError(svc.createReservation(ACTOR, VALID_INPUT), 400);
  });

  it('başarılı oluşturmada yıldız verilir ve referral tetiklenir (S18-3)', async () => {
    await svc.createReservation(ACTOR, VALID_INPUT);
    expect(awardStars).toHaveBeenCalledWith(ACTOR.id, 'RESERVATION', expect.any(String), 'res-1');
    expect(maybeAwardReferrer).toHaveBeenCalledWith(ACTOR.id);
  });
});

describe('S19-4 öncelik sıralaması', () => {
  const rows = [
    { id: 'a', date: '2026-09-01', time: '19:00', user: { id: 'u-a', displayName: 'A', starCount: 10 } },
    { id: 'b', date: '2026-09-01', time: '20:00', user: { id: 'u-b', displayName: 'B', starCount: 300 } },
  ];

  beforeEach(() => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.reservation.findMany.mockResolvedValue(rows);
    getLevel.mockImplementation((s) => ({ level: s >= 250 ? 5 : 1 }));
    getLevelAccess.mockImplementation((lvl) => ({ reservationPriority: lvl >= 3 ? 3 : 0 }));
  });

  it('PENDING listesinde öncelikli kullanıcı EN ÜSTE çıkar', async () => {
    const result = await svc.getRestaurantReservations('owner-1', { status: 'PENDING' });
    expect(result.map((r) => r.id)).toEqual(['b', 'a']);
    expect(result[0].isPriority).toBe(true);
    expect(result[1].isPriority).toBe(false);
  });

  it('starCount yanıtta SIZDIRILMAZ', async () => {
    const result = await svc.getRestaurantReservations('owner-1', { status: 'PENDING' });
    for (const r of result) {
      expect(r.user).not.toHaveProperty('starCount');
      expect(r).toHaveProperty('userLevel');
    }
  });

  it('PENDING dışındaki filtrede DB sırası korunur', async () => {
    const result = await svc.getRestaurantReservations('owner-1', { status: 'CONFIRMED' });
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('onay — rezerve koltuk (S19-3)', () => {
  beforeEach(() => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r1', businessName: 'Test AŞ' });
    prisma.reservation.findUnique.mockResolvedValue({ id: 'res-1', restaurantId: 'r1', status: 'PENDING', guestCount: 4, date: FUTURE, time: '20:00', userId: 'u-1', placeName: 'T' });
    prisma.reservation.update.mockResolvedValue({ id: 'res-1' });
  });

  it('reservedSeats verilmezse guestCount varsayılan olur', async () => {
    await svc.updateReservationStatus('owner-1', 'res-1', { status: 'CONFIRMED' });
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reservedSeats: 4 }) }),
    );
  });

  it('reservedSeats sınır dışıysa 400', async () => {
    await expectHttpError(
      svc.updateReservationStatus('owner-1', 'res-1', { status: 'CONFIRMED', reservedSeats: 0 }),
      400,
    );
  });

  it('red için gerekçe zorunlu', async () => {
    await expectHttpError(svc.updateReservationStatus('owner-1', 'res-1', { status: 'REJECTED' }), 400);
  });

  it('PENDING olmayan rezervasyon güncellenemez', async () => {
    prisma.reservation.findUnique.mockResolvedValue({ id: 'res-1', restaurantId: 'r1', status: 'CONFIRMED' });
    await expectHttpError(svc.updateReservationStatus('owner-1', 'res-1', { status: 'CONFIRMED' }), 400);
  });
});

describe('katılım işaretleme — yıldız etkileri', () => {
  beforeEach(() => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r1', businessName: 'Test AŞ' });
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1', restaurantId: 'r1', status: 'CONFIRMED', attended: null, userId: 'u-1', date: FUTURE, time: '20:00',
    });
    prisma.reservation.update.mockResolvedValue({ id: 'res-1' });
  });

  it('geldi → yıldız verilir', async () => {
    await svc.markAttendance('owner-1', 'res-1', { attended: true });
    expect(awardStars).toHaveBeenCalledWith('u-1', 'RESERVATION_ATTENDED', expect.any(String), 'res-1');
    expect(deductStars).not.toHaveBeenCalled();
  });

  it('gelmedi → yıldız düşülür (no-show cezası)', async () => {
    await svc.markAttendance('owner-1', 'res-1', { attended: false });
    expect(deductStars).toHaveBeenCalledWith('u-1', 10, expect.any(String), 'res-1');
    expect(awardStars).not.toHaveBeenCalled();
  });

  it('zaten işaretlenmişse tekrar işaretlenemez (çift yıldız yok)', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1', restaurantId: 'r1', status: 'CONFIRMED', attended: true,
    });
    await expectHttpError(svc.markAttendance('owner-1', 'res-1', { attended: true }), 400);
    expect(awardStars).not.toHaveBeenCalled();
  });

  it('başka restorana ait rezervasyon işaretlenemez', async () => {
    prisma.reservation.findUnique.mockResolvedValue({ id: 'res-1', restaurantId: 'BASKA', status: 'CONFIRMED', attended: null });
    await expectHttpError(svc.markAttendance('owner-1', 'res-1', { attended: true }), 404);
  });
});

describe('güncelleme — atomiklik', () => {
  it('eski iptal + yeni oluşturma TEK transaction içinde yapılır', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'old-1', userId: ACTOR.id, status: 'PENDING', restaurantId: 'r1', placeId: 'p1', placeName: 'T',
      restaurant: { userId: 'owner-1', businessName: 'T' },
    });
    prisma.restaurantProfile.findUnique.mockResolvedValue({ tableCount: null });
    prisma.$transaction.mockResolvedValue([{}, { id: 'new-1' }]);

    await svc.updateReservation(ACTOR, 'old-1', { date: FUTURE, time: '21:00', guestCount: 2 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('erişim yetkisi', () => {
  it('taraf olmayan kullanıcı detaya erişemez', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1', userId: 'baska', restaurant: { userId: 'owner-x' },
    });
    await expectHttpError(svc.getReservationDetail('u-1', 'res-1'), 403);
  });

  it('taraf olmayan kullanıcı mesaj gönderemez', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1', userId: 'baska', restaurant: { userId: 'owner-x', businessName: 'T' },
    });
    await expectHttpError(svc.sendMessage(ACTOR, 'res-1', { content: 'merhaba' }), 403);
    expect(prisma.reservationMessage.create).not.toHaveBeenCalled();
  });
});
