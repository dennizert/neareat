// Prototype pollution ve stored XSS'e karşı request body temizleme.
// Prisma parametrize query kullandığı için SQL injection coverage dışında.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Tek bir değeri özyinelemeli temizler: string'lerden HTML etiketlerini söker (stored XSS),
// dizi/nesneleri derinlemesine dolaşır. Diğer tipleri (number/bool) olduğu gibi bırakır.
function sanitizeValue(val) {
  if (typeof val === 'string') return val.replace(/<[^>]*>/g, '').trim();
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object' && val.constructor === Object) {
    return sanitizeObject(val);
  }
  return val;
}

// Nesneyi temizler ve tehlikeli anahtarları (__proto__/constructor/prototype) atar →
// prototype pollution saldırılarını engeller.
function sanitizeObject(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    if (BLOCKED_KEYS.has(key)) continue;
    result[key] = sanitizeValue(obj[key]);
  }
  return result;
}

// Body-parse'tan hemen sonra çalışan global middleware: gelen req.body'yi baştan temizler.
module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};
