'use strict';

/**
 * Senaryo fabrikaları — GERÇEK veritabanı satırları üretir.
 *
 * Neden API üzerinden değil de doğrudan yazıyoruz: bir yolculuğun ÖN KOŞULU (onaylı bir
 * restoran, 3. seviyede bir kullanıcı) o yolculuğun test ettiği şey değildir. Ön koşulu
 * API adımlarıyla kurmak testi hem yavaşlatır hem de asıl doğrulanan akışı gürültüye boğar.
 *
 * Kural: yolculuğun KONUSU olan adımlar her zaman istemci üzerinden (API ile) yapılır;
 * yalnızca sahne hazırlığı buradan yazılır.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../../src/utils/prisma');
const { signToken } = require('../../src/utils/jwt');
const { createClient } = require('./client/apiClient');

let counter = 0;
/** Testler arasında çakışmayan benzersiz ek — e-posta/vergi no gibi unique alanlar için. */
function uniq(prefix = '') {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

/**
 * Oturum açmış bir kullanıcı üretir ve ona bağlı bir istemci döndürür.
 *
 * @param {object} app express uygulaması
 * @param {object} [opts]
 * @param {number} [opts.starCount] seviye testleri için (L1 0-49 · L2 50-99 · L3 100-149 · L4 150-249 · L5 250+)
 * @param {string} [opts.role] USER | RESTAURANT | ADMIN
 * @returns {Promise<{ user: object, client: import('./client/apiClient').ApiClient }>}
 */
async function createUser(app, opts = {}) {
  const suffix = uniq('u');
  const user = await prisma.user.create({
    data: {
      email: opts.email || `${suffix}@e2e.test`,
      displayName: opts.displayName || `Kullanıcı ${suffix}`,
      passwordHash: await bcrypt.hash(opts.password || 'Test1234!', 4), // düşük cost — test hızı
      authProvider: 'email',
      role: opts.role || 'USER',
      emailVerified: opts.emailVerified ?? true,
      starCount: opts.starCount ?? 0,
      isSuspended: opts.isSuspended ?? false,
      isPublic: opts.isPublic ?? true,
    },
  });

  const client = createClient(app).authenticate(signToken(user.id), user);
  return { user, client };
}

/** Aktif (ödeyen) abonelik ekler — restoran özellik kapılarını açar (S19-1). */
async function giveActiveSubscription(userId, { planType = 'monthly', days = 30 } = {}) {
  return prisma.subscription.create({
    data: {
      userId,
      planType,
      status: 'active',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Restoran sahibi + profil üretir.
 *
 * @param {object} app
 * @param {object} [opts]
 * @param {boolean} [opts.approved=true] APPROVED mı PENDING mi
 * @param {boolean} [opts.active=true] aktif abonelik (S19-1 kapıları)
 * @param {boolean} [opts.acceptsReservations=true]
 * @param {number|null} [opts.seatCapacity] doluluk/overbooking senaryoları için
 * @param {number|null} [opts.tableCount]
 */
async function createRestaurant(app, opts = {}) {
  const suffix = uniq('r');
  const owner = await prisma.user.create({
    data: {
      email: `${suffix}@e2e.test`,
      displayName: opts.businessName || `Restoran ${suffix}`,
      passwordHash: await bcrypt.hash('Test1234!', 4),
      authProvider: 'email',
      role: 'RESTAURANT',
      emailVerified: true,
    },
  });

  const approved = opts.approved ?? true;
  const profile = await prisma.restaurantProfile.create({
    data: {
      userId: owner.id,
      businessName: opts.businessName || `Restoran ${suffix}`,
      ownerName: 'Test Sahibi',
      taxNumber: String(1000000000 + (counter % 8999999999)).slice(0, 10),
      taxOffice: 'Test Vergi Dairesi',
      phone: '05001112233',
      contactEmail: `${suffix}@e2e.test`,
      address: 'Test Adres, İstanbul',
      businessCategory: 'Restoran',
      placeId: opts.placeId || `place-${suffix}`,
      placeName: opts.placeName || opts.businessName || `Restoran ${suffix}`,
      status: approved ? 'APPROVED' : 'PENDING',
      approvedAt: approved ? new Date() : null,
      acceptsReservations: opts.acceptsReservations ?? true,
      seatCapacity: opts.seatCapacity ?? null,
      tableCount: opts.tableCount ?? null,
    },
  });

  if (opts.active ?? true) await giveActiveSubscription(owner.id);

  const client = createClient(app).authenticate(signToken(owner.id), owner);
  return { owner, profile, client };
}

/** Admin kullanıcısı + oturum açmış istemci. */
async function createAdmin(app, opts = {}) {
  const password = opts.password || 'Admin1234!';
  const suffix = uniq('a');
  const admin = await prisma.user.create({
    data: {
      email: opts.email || `${suffix}@e2e.test`,
      displayName: 'Admin',
      passwordHash: await bcrypt.hash(password, 4),
      authProvider: 'email',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  const client = createClient(app).authenticate(signToken(admin.id), admin);
  return { admin, client, password };
}

/** İki kullanıcıyı kabul edilmiş arkadaş yapar (sosyal yolculukların ön koşulu). */
async function makeFriends(userAId, userBId) {
  return prisma.friendRequest.create({
    data: { fromUserId: userAId, toUserId: userBId, status: 'ACCEPTED' },
  });
}

/**
 * Doğrulanmış ziyaret üretir — S18-3 yıldız kuralları check-in veya tamamlanmış
 * rezervasyon şartı arıyor.
 */
async function createCheckIn(userId, placeId, placeName = 'Test Restoran', { hoursValid = 4 } = {}) {
  return prisma.checkIn.create({
    data: {
      userId,
      placeId,
      placeName,
      // `expiresAt` zorunlu: check-in geçici bir "buradayım" işaretidir, kalıcı değil.
      expiresAt: new Date(Date.now() + hoursValid * 60 * 60 * 1000),
    },
  });
}

/** Bugünden N gün sonrası — geçmiş-tarih doğrulamasına takılmayan rezervasyon tarihi. */
function futureDate(daysAhead = 7) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

module.exports = {
  createUser,
  createRestaurant,
  createAdmin,
  giveActiveSubscription,
  makeFriends,
  createCheckIn,
  futureDate,
  uniq,
};
