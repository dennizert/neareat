const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { getAuth } = require('../services/firebase');
const { signToken } = require('../utils/jwt');

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
        },
      });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    res.json({ user, subscription });
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
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
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
    res.status(201).json({ user, subscription: null, token });
  } catch (err) {
    next(err);
  }
}

async function loginEmail(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email ve password zorunlu' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const token = signToken(user.id);
    res.json({ user, subscription, token });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });
  res.json({ user: req.user, subscription });
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
