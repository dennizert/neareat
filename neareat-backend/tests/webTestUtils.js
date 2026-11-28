'use strict';

/**
 * Web paneli testleri (#524/#525/#526) için ortak yardımcılar.
 *
 * `createFakePrisma`: `user` ve `webSession` için BELLEKTE durum tutan sahte Prisma —
 * oturum akışı çok adımlıdır (giriş → çerez → oturum → çıkış) ve adımların birbirine
 * bağlanabilmesi için satırların gerçekten saklanması gerekir. Diğer modeller için her
 * metodu `null` dönen otomatik `jest.fn()` üretilir; testler gerektiğinde üzerine yazar.
 */

const bcrypt = require('bcryptjs');

function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

function createFakePrisma() {
  const users = new Map();
  const sessions = new Map();

  const user = {
    findUnique: jest.fn(async ({ where }) => {
      for (const u of users.values()) if (matches(u, where)) return { ...u };
      return null;
    }),
    findFirst: jest.fn(async ({ where } = {}) => {
      for (const u of users.values()) if (matches(u, where)) return { ...u };
      return null;
    }),
    update: jest.fn(async ({ where, data }) => {
      const u = users.get(where.id);
      if (!u) throw new Error('user not found');
      Object.assign(u, data);
      return { ...u };
    }),
    create: jest.fn(async ({ data }) => {
      const u = { id: `u-${users.size + 1}`, ...data };
      users.set(u.id, u);
      return { ...u };
    }),
    delete: jest.fn(async ({ where }) => {
      const u = users.get(where.id);
      users.delete(where.id);
      return u;
    }),
    count: jest.fn(async () => users.size),
  };

  const webSession = {
    findUnique: jest.fn(async ({ where, include }) => {
      const s = sessions.get(where.id);
      if (!s) return null;
      const out = { ...s };
      if (include?.user) out.user = users.has(s.userId) ? { ...users.get(s.userId) } : null;
      return out;
    }),
    create: jest.fn(async ({ data }) => {
      const s = { mfaVerifiedAt: null, revokedAt: null, createdAt: new Date(Date.now()), ...data };
      sessions.set(s.id, s);
      return { ...s };
    }),
    update: jest.fn(async ({ where, data }) => {
      const s = sessions.get(where.id);
      if (!s) throw new Error('session not found');
      Object.assign(s, data);
      return { ...s };
    }),
    deleteMany: jest.fn(async ({ where }) => {
      let count = 0;
      for (const [id, s] of sessions) {
        if (matches(s, where)) { sessions.delete(id); count += 1; }
      }
      return { count };
    }),
  };

  const base = {
    user,
    webSession,
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    __users: users,
    __sessions: sessions,
  };
  base.$transaction = jest.fn((arg) => (typeof arg === 'function' ? arg(proxy) : Promise.all(arg)));

  const autoModels = {};
  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string' || prop === 'then' || prop.startsWith('__')) return undefined;
      if (!autoModels[prop]) {
        autoModels[prop] = new Proxy({}, {
          get(m, fn) {
            if (!m[fn]) m[fn] = jest.fn().mockResolvedValue(null);
            return m[fn];
          },
        });
      }
      return autoModels[prop];
    },
  });
  return proxy;
}

const VALID_PW = 'dogru-sifre-123';
const VALID_PW_HASH = bcrypt.hashSync(VALID_PW, 4);

/** Sahte DB'ye kullanıcı ekler. */
function seedUser(prisma, overrides = {}) {
  const id = overrides.id || `user-${prisma.__users.size + 1}`;
  const u = {
    id,
    email: `${id}@test.com`,
    displayName: 'Test',
    photoUrl: null,
    googleId: null,
    fcmToken: null,
    passwordHash: VALID_PW_HASH,
    authProvider: 'email',
    role: 'RESTAURANT',
    isSuspended: false,
    emailVerified: true,
    starCount: 0,
    bio: null,
    city: null,
    favoriteCuisines: [],
    isPublic: true,
    shareWithFriendsRecommender: false,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  prisma.__users.set(id, u);
  return u;
}

/** `Set-Cookie` yanıtından oturum çerezinin ham değerini çıkarır. */
function extractSid(res) {
  const header = [].concat(res.headers['set-cookie'] || []).find((c) => c.startsWith('__Host-eatlas_sid='));
  if (!header) return null;
  return decodeURIComponent(header.split(';')[0].split('=').slice(1).join('='));
}

/** Her test/istek grubuna ayrı IP — authLimiter (20/15dk) bütçesi testler arasında taşmasın. */
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

module.exports = { createFakePrisma, seedUser, extractSid, nextIp, VALID_PW };
