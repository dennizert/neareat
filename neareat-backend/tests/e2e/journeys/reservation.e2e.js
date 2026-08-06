'use strict';

/**
 * YOLCULUK: Rezervasyonun tam yaşam döngüsü — iki taraflı.
 *
 * Bu dosya, altyapının asıl gerekçesini gösteriyor: bir kullanıcı rezervasyon oluşturur,
 * BAŞKA bir oturum (restoran) onu kendi listesinde görür, onaylar; sonra ilk kullanıcı
 * kendi listesinde durumun değiştiğini görür. Üç farklı aktörün aynı veri üzerinde
 * sırayla çalışması, mock'lu bir pakette taklit edilemez — orada her adımın dönüşü elle
 * yazıldığı için "restoranın gördüğü şey, kullanıcının yazdığı şeydir" iddiası
 * doğrulanmamış kalır.
 */

const app = require('../../../src/app');
const { createUser, createRestaurant, createCheckIn, futureDate } = require('../factories');

const DATE = futureDate(10);
const TIME = '20:00';

describe('Yolculuk: rezervasyon talebi → restoran onayı → katılım', () => {
  it('kullanıcı rezervasyon oluşturur, restoran görür ve onaylar, kullanıcı güncel durumu görür', async () => {
    // L3 kullanıcı: sınırsız rezervasyon hakkı (S18-2), akış limite takılmasın.
    const { client: user } = await createUser(app, { starCount: 120 });
    const { profile, client: restaurant } = await createRestaurant(app, { seatCapacity: 50 });

    // 1) Kullanıcı rezervasyon talebi gönderir.
    const created = await user.reservations.create({
      placeId: profile.placeId,
      date: DATE,
      time: TIME,
      guestCount: 4,
    });
    expect(created.status).toBe('PENDING');
    // Kapasite yeterli → overbooking uyarısı OLMAMALI.
    expect(created).not.toHaveProperty('warning');

    // 2) Restoran kendi panelinde bekleyen talebi görür — kullanıcının YAZDIĞI kayıt.
    const pending = await restaurant.reservations.getForRestaurant('PENDING');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(created.id);
    expect(pending[0].guestCount).toBe(4);
    // S19-4: seviye/öncelik bilgisi var, ham yıldız sayısı SIZDIRILMAZ.
    expect(pending[0]).toHaveProperty('userLevel');
    expect(pending[0].user).not.toHaveProperty('starCount');

    // 3) Restoran onaylar ve 4 koltuk rezerve eder (S19-3).
    const confirmed = await restaurant.reservations.updateStatus(created.id, 'CONFIRMED', undefined, 4);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.reservedSeats).toBe(4);

    // 4) Kullanıcı kendi listesinde güncel durumu görür.
    const mine = await user.reservations.getMine();
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('CONFIRMED');

    // 5) Doluluk paneli onaylanan koltukları yansıtır (S19-2).
    const occupancy = await restaurant.restaurantAccount.getOccupancy(DATE);
    expect(occupancy.seatCapacity).toBe(50);
    const busySlot = occupancy.slots.find((s) => s.reserved > 0);
    expect(busySlot).toBeDefined();
    expect(busySlot.reserved).toBe(4);
    expect(busySlot.free).toBe(46);
  });

  it('restoran katılımı işaretler, kullanıcı yıldız kazanır', async () => {
    const { user: u, client: user } = await createUser(app, { starCount: 120 });
    const { profile, client: restaurant } = await createRestaurant(app);

    const created = await user.reservations.create({
      placeId: profile.placeId, date: DATE, time: TIME, guestCount: 2,
    });
    await restaurant.reservations.updateStatus(created.id, 'CONFIRMED', undefined, 2);

    const starsBefore = await user.social.getStarEvents();
    await restaurant.reservations.markAttendance(created.id, true);

    // Yıldız verilmesi fire-and-forget; kaydın düşmesini bekle.
    await new Promise((r) => setTimeout(r, 300));

    const starsAfter = await user.social.getStarEvents();
    expect(starsAfter.length).toBeGreaterThan(starsBefore.length);
    expect(starsAfter.some((e) => e.type === 'RESERVATION_ATTENDED')).toBe(true);

    const detail = await user.reservations.getDetail(created.id);
    expect(detail.status).toBe('COMPLETED');
    expect(detail.attended).toBe(true);
    expect(u.id).toEqual(expect.any(String));
  });

  it('S18-2: L1 kullanıcı ikinci rezervasyonda seviye duvarına çarpar', async () => {
    // starCount 0 → L1: yalnızca İLK (onboarding) rezervasyon.
    const { client: user } = await createUser(app, { starCount: 0 });
    const { profile } = await createRestaurant(app);

    await user.reservations.create({ placeId: profile.placeId, date: DATE, time: '18:00', guestCount: 2 });

    const err = await user.reservations
      .create({ placeId: profile.placeId, date: DATE, time: '21:00', guestCount: 2 })
      .then(() => null, (e) => e);

    expect(err.status).toBe(403);
    // Mobil (S18-5 levelGate) tam olarak bu alanlara bakıyor.
    expect(err.body.code).toBe('LEVEL_REQUIRED');
    expect(err.body.requiredLevel).toBe(2);
    expect(err.body.feature).toBe('reservation');
  });

  it('S19-3: kapasite dolduğunda talep yine oluşur ama overbooking uyarısı döner', async () => {
    const { client: userA } = await createUser(app, { starCount: 120 });
    const { client: userB } = await createUser(app, { starCount: 120 });
    const { profile, client: restaurant } = await createRestaurant(app, { seatCapacity: 4 });

    // İlk kullanıcı tüm kapasiteyi doldurur (onaylandığında koltuklar düşer).
    const first = await userA.reservations.create({
      placeId: profile.placeId, date: DATE, time: TIME, guestCount: 4,
    });
    await restaurant.reservations.updateStatus(first.id, 'CONFIRMED', undefined, 4);

    // İkinci kullanıcı aynı dilime talep gönderir.
    const second = await userB.reservations.create({
      placeId: profile.placeId, date: DATE, time: TIME, guestCount: 2,
    });

    // Talep REDDEDİLMEZ — oluşur, ama uyarı taşır (S19-6 mobil bu metni gösteriyor).
    expect(second.status).toBe('PENDING');
    expect(second.warning).toBe('OVERBOOKING');
    expect(second.message).toBe(
      'Restoranda talebinize uygun yer kalmamıştır. Talebiniz oluşturulmuştur, restoran planlama yapabilirse onaylanacaktır. Aksi halde reddedilecektir.',
    );
  });

  it('kullanıcı rezervasyonunu iptal eder, restoran listesinde artık bekleyen kalmaz', async () => {
    const { client: user } = await createUser(app, { starCount: 120 });
    const { profile, client: restaurant } = await createRestaurant(app);

    const created = await user.reservations.create({
      placeId: profile.placeId, date: futureDate(20), time: TIME, guestCount: 2,
    });
    await user.reservations.cancel(created.id);

    const pending = await restaurant.reservations.getForRestaurant('PENDING');
    expect(pending).toHaveLength(0);

    const mine = await user.reservations.getMine();
    expect(mine[0].status).toBe('CANCELLED');
  });

  it('taraf olmayan üçüncü kullanıcı rezervasyon detayını göremez', async () => {
    const { client: user } = await createUser(app, { starCount: 120 });
    const { client: yabanci } = await createUser(app, { starCount: 120 });
    const { profile } = await createRestaurant(app);

    const created = await user.reservations.create({
      placeId: profile.placeId, date: DATE, time: TIME, guestCount: 2,
    });

    await expect(yabanci.reservations.getDetail(created.id)).rejects.toMatchObject({ status: 403 });
  });

  it('rezervasyona kapalı restoranda talep oluşturulamaz', async () => {
    const { client: user } = await createUser(app, { starCount: 120 });
    const { profile } = await createRestaurant(app, { acceptsReservations: false });

    await expect(
      user.reservations.create({ placeId: profile.placeId, date: DATE, time: TIME, guestCount: 2 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('S18-3: ziyaret doğrulaması olmadan puan verilemez, check-in sonrası verilebilir', async () => {
    const { user: u, client: user } = await createUser(app, { starCount: 120 });
    const { profile } = await createRestaurant(app);

    // Ziyaret yok → 403 VISIT_REQUIRED
    const err = await user.social
      .rateRestaurant(profile.placeId, profile.placeName)
      .then(() => null, (e) => e);
    expect(err.status).toBe(403);
    expect(err.body.code).toBe('VISIT_REQUIRED');

    // Check-in (doğrulanmış ziyaret) sonrası puanlama açılır.
    await createCheckIn(u.id, profile.placeId, profile.placeName);
    const rated = await user.social.rateRestaurant(profile.placeId, profile.placeName);
    expect(rated.starEvent).toBeTruthy();
  });
});
