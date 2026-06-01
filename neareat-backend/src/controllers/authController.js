const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const { getAuth } = require('../services/firebase');
const { verifyGoogleIdToken } = require('../services/googleAuth');
const { signToken } = require('../utils/jwt');
const { logRequest } = require('../services/logService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

function sanitizeUser(user) {
  const {
    passwordHash, bio, city, favoriteCuisines, isPublic, starCount,
    shareWithFriendsRecommender, // profile data, getMyProfile'da döner
    emailVerificationToken, emailVerificationExpiry,
    passwordResetToken, passwordResetExpiry,
    ...safe
  } = user;
  return safe;
}

async function login(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    // Mobilden gelen Google OAuth idToken'ı google-auth-library ile doğrula.
    // payload.sub Google'ın kalıcı kullanıcı kimliğidir (googleId olarak saklanır).
    const decoded = await verifyGoogleIdToken(idToken);
    if (!decoded?.email) return res.status(400).json({ error: 'Google hesabında e-posta bulunamadı' });

    let user = await prisma.user.findUnique({ where: { googleId: decoded.sub } });
    let isNew = false;
    if (!user) {
      // googleId ile bulunamadı — aynı e-postayla mevcut bir hesap var mı?
      // (email/şifre ile kayıtlı ya da eski bir hesap olabilir.) Varsa googleId'yi
      // o hesaba bağla (account linking) — yeni kayıt yerine. Aksi halde P2002 (email unique).
      const existingByEmail = await prisma.user.findUnique({ where: { email: decoded.email } });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: decoded.sub,
            photoUrl: existingByEmail.photoUrl || decoded.picture || null,
            lastLoginAt: new Date(),
          },
        });
      } else {
        isNew = true;
        user = await prisma.user.create({
          data: {
            googleId: decoded.sub,
            email: decoded.email,
            displayName: decoded.name || decoded.email.split('@')[0],
            photoUrl: decoded.picture || null,
            authProvider: 'google',
            emailVerified: true, // Google hesapları doğrulanmış sayılır
            lastLoginAt: new Date(),
          },
        });
      }
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    logRequest({ req: { ...req, user }, page: 'Giriş', action: isNew ? 'Google ile kayıt oldu' : 'Google ile giriş yaptı' }).catch(() => {});
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
    const emailVerificationToken = uuidv4();
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        displayName: trimmedName,
        passwordHash,
        authProvider: 'email',
        emailVerificationToken,
        emailVerificationExpiry,
      },
    });

    sendVerificationEmail(user.email, user.displayName, emailVerificationToken)
      .catch(e => console.error('[EMAIL] Doğrulama gönderilemedi:', e.message));

    const token = signToken(user.id);
    logRequest({ req: { ...req, user }, page: 'Kayıt', action: 'Email ile kayıt oldu', details: email.toLowerCase() }).catch(() => {});
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
    logRequest({ req: { ...req, user }, page: 'Giriş', action: 'Email ile giriş yaptı' }).catch(() => {});
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
    logRequest({ req, page: 'Profil', action: 'Hesabını sildi' }).catch(() => {});
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

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token zorunlu' });

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş doğrulama bağlantısı' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    res.json({ message: 'E-posta başarıyla doğrulandı' });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const user = req.user;

    if (user.emailVerified) {
      return res.status(400).json({ error: 'E-posta zaten doğrulanmış' });
    }

    const emailVerificationToken = uuidv4();
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationExpiry },
    });

    sendVerificationEmail(user.email, user.displayName, emailVerificationToken)
      .catch(e => console.error('[EMAIL] Yeniden gönderim başarısız:', e.message));

    res.json({ message: 'Doğrulama e-postası tekrar gönderildi' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-posta zorunlu' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.json({ message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi' });
    }
    if (user.authProvider !== 'email') {
      return res.status(400).json({ error: 'Bu hesap Google ile oluşturulmuş. Giriş ekranından "Google ile Giriş Yap" seçeneğini kullan.' });
    }

    const passwordResetToken = uuidv4();
    const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken, passwordResetExpiry },
    });

    sendPasswordResetEmail(user.email, user.displayName, passwordResetToken)
      .catch(e => console.error('[EMAIL] Şifre sıfırlama gönderilemedi:', e.message));

    res.json({ message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token ve şifre zorunlu' });
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Şifre 8-128 karakter arasında olmalı' });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    res.json({ message: 'Şifre başarıyla güncellendi' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, loginEmail, getMe, deleteAccount, verifyEmail, resendVerification, forgotPassword, resetPassword };
