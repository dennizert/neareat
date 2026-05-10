const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { getAuth } = require('../services/firebase');
const { signToken } = require('../utils/jwt');

function sanitizeUser(user) {
  const { passwordHash, bio, city, favoriteCuisines, isPublic, starCount, ...safe } = user;
  return safe;
}

async function login(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const decoded = await getAuth().verifyIdToken(idToken);

    let user = await prisma.user.findUnique({ where: { googleId: decoded.uid } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: decoded.uid,
          email: decoded.email,
          displayName: decoded.name || decoded.email.split('@')[0],
          photoUrl: decoded.picture || null,
          authProvider: 'google',
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    res.json({ user: sanitizeUser(user), subscription });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'email, password ve displayName zorunlu' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Şifre 8-128 karakter arasında olmalı' });
    }
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({ error: 'İsim en az 2 karakter olmalı' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        displayName: trimmedName,
        passwordHash,
        authProvider: 'email',
      },
    });

    const token = signToken(user.id);
    res.status(201).json({ user: sanitizeUser(user), subscription: null, token });
  } catch (err) {
    next(err);
  }
}

// Timing-safe dummy hash — user bulunamasa bile bcrypt süresi normalize edilir
const DUMMY_HASH = '$2a$10$X/KGqsN7fZa.LFpuN8VqreONKkfOX.jZTqf4RBm7J6FS2EeL9Ge8G';

async function loginEmail(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email ve password zorunlu' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Timing attack'ı önlemek için user bulunmasa da bcrypt her zaman çalışır
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.passwordHash || !valid) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const [subscription, restaurantProfile] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId: user.id } }),
      user.role === 'RESTAURANT'
        ? prisma.restaurantProfile.findUnique({
            where: { userId: user.id },
            select: { id: true, status: true, rejectionReason: true, businessName: true, placeId: true },
          })
        : null,
    ]);
    const token = signToken(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ user: sanitizeUser(user), subscription, token, restaurantProfile });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  const [subscription, restaurantProfile] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: req.user.id } }),
    req.user.role === 'RESTAURANT'
      ? prisma.restaurantProfile.findUnique({
          where: { userId: req.user.id },
          select: { id: true, status: true, rejectionReason: true, businessName: true, placeId: true },
        })
      : null,
  ]);
  res.json({ user: sanitizeUser(req.user), subscription, restaurantProfile });
}

async function deleteAccount(req, res, next) {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    if (req.user.googleId) {
      try {
        await getAuth().deleteUser(req.user.googleId);
      } catch {
        // Firebase kullanıcısı yoksa sessizce devam et
      }
    }
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, loginEmail, getMe, deleteAccount };
