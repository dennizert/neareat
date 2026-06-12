// Uç-bazlı zod şemaları (S14-B2). validate(schema) middleware'i ile kullanılır.
// Mesajlar Türkçe ve mevcut davranışla uyumlu tutulur (kabul/ret durum kodları değişmez).
const { z } = require('zod');

const PASSWORD_MSG = 'Şifre 8-128 karakter arasında olmalı';

// POST /api/auth/register
const registerSchema = z.object({
  email: z.string().min(1, 'email zorunlu').transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, PASSWORD_MSG).max(128, PASSWORD_MSG),
  displayName: z.string().transform((s) => s.trim()).pipe(z.string().min(2, 'İsim en az 2 karakter olmalı')),
});

// POST /api/auth/login/email
const loginEmailSchema = z.object({
  email: z.string().min(1, 'email zorunlu').transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, 'password zorunlu'),
});

// POST /api/reviews
const reviewCreateSchema = z.object({
  placeId: z.string().min(1, 'placeId zorunlu'),
  rating: z.coerce.number().int().min(1, 'rating 1-5 arasında olmalı').max(5, 'rating 1-5 arasında olmalı'),
  body: z.string().min(1, 'body zorunlu'),
  placeName: z.string().optional(),
});

module.exports = { registerSchema, loginEmailSchema, reviewCreateSchema };
