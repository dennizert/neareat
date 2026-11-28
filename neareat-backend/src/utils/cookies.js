'use strict';

/**
 * Küçük çerez yardımcıları (issue #524). `cookie-parser` bağımlılığı eklenmedi: tek bir
 * çerez okunuyor ve imzalı çerez gerekmiyor (değer zaten opak rastgele kimlik, DB'de HMAC'i
 * aranıyor).
 */

/**
 * `Cookie` başlığından tek bir çerezin değerini okur.
 * @param {string|undefined} header
 * @param {string} name
 * @returns {string|null}
 */
function readCookie(header, name) {
  if (typeof header !== 'string' || !header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const raw = part.slice(idx + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * `Set-Cookie` değeri üretir. Nitelikler sabittir: `__Host-` öneki tarayıcıda
 * `Secure` + `Path=/` + Domain YOK şartını zorunlu kılar; HttpOnly → JS okuyamaz (XSS ile
 * çalınamaz); SameSite=Lax → çapraz site POST'ta gönderilmez.
 *
 * @param {string} name
 * @param {string} value
 * @param {{ maxAgeSeconds: number }} opts maxAge 0 → çerezi siler
 */
function serializeSessionCookie(name, value, { maxAgeSeconds }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

module.exports = { readCookie, serializeSessionCookie };
