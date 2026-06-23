'use strict';

// S18-1: Seviye → özellik erişimi için TEK YETKİLİ kaynak.
// Kullanıcı premium modeli kaldırıldı; özellikler kazanılan yıldız seviyesine (1–5) göre açılır.
// Tüm controller limit kararları (AI öneri/gün, rezervasyon, liste, favori, restoran önerme,
// rezervasyon önceliği) buradan okur — magic number controller'lara sızmaz.
//
// `null` = SINIRSIZ (sayısal limitlerde). Çağıranlar `limit === null` ise sınırsız kabul eder,
// aksi halde sayıyı üst sınır olarak kullanır. (Infinity yerine null: JSON'a güvenle serialize olur.)

const { getLevel } = require('./stars');
const prisma = require('./prisma');

// Seviye → yetki matrisi (proje kararı, 2026-06-23). Tek noktada sabit.
const LEVEL_ACCESS = {
  1: { maxReservationsPerMonth: 0,    aiPerDay: 1,    canCreateLists: false, favoritesLimit: 5,    canSuggestRestaurant: false, reservationPriority: 0 },
  2: { maxReservationsPerMonth: 1,    aiPerDay: 5,    canCreateLists: true,  favoritesLimit: 15,   canSuggestRestaurant: false, reservationPriority: 0 },
  3: { maxReservationsPerMonth: null, aiPerDay: 10,   canCreateLists: true,  favoritesLimit: 30,   canSuggestRestaurant: true,  reservationPriority: 1 },
  4: { maxReservationsPerMonth: null, aiPerDay: 20,   canCreateLists: true,  favoritesLimit: 50,   canSuggestRestaurant: true,  reservationPriority: 2 },
  5: { maxReservationsPerMonth: null, aiPerDay: null, canCreateLists: true,  favoritesLimit: null, canSuggestRestaurant: true,  reservationPriority: 3 },
};

// Bir seviyenin (1–5) yetki nesnesini döndürür. Saf, senkron, DB'siz.
// Sınır dışı/tanımsız seviyeler güvenli şekilde L1'e clamp'lenir (asla çökmez).
function getLevelAccess(level) {
  const lvl = Number.isFinite(level) ? Math.min(5, Math.max(1, Math.round(level))) : 1;
  return LEVEL_ACCESS[lvl];
}

// Bir sayısal limitin "sınırsız" olup olmadığını söyleyen yardımcı (null = sınırsız).
function isUnlimited(limit) {
  return limit === null;
}

// Kullanıcının starCount'undan seviyesini hesaplayıp yetki nesnesini döndürür (tek DB okuması).
// Controller'lar için ana giriş noktası. Kullanıcı yoksa L1 erişimi döner.
async function getUserAccess(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { starCount: true },
  });
  const level = user ? getLevel(user.starCount).level : 1;
  return { level, access: getLevelAccess(level) };
}

module.exports = { getLevelAccess, getUserAccess, isUnlimited, LEVEL_ACCESS };
