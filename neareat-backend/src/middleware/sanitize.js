// Prototype pollution ve stored XSS'e karşı request body temizleme.
// Prisma parametrize query kullandığı için SQL injection coverage dışında.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeValue(val) {
  if (typeof val === 'string') return val.replace(/<[^>]*>/g, '').trim();
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object' && val.constructor === Object) {
    return sanitizeObject(val);
  }
  return val;
}

function sanitizeObject(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    if (BLOCKED_KEYS.has(key)) continue;
    result[key] = sanitizeValue(obj[key]);
  }
  return result;
}

module.exports = function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};
