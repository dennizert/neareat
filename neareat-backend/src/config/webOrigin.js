'use strict';

/**
 * Web panelinin genel origin'i (ADR-001 #5, #7; issue #525).
 *
 * `PUBLIC_WEB_ORIGIN` üç yerde kullanılır ve hepsi BU dosyadan okur:
 *  1. CORS izin listesine otomatik eklenir (tarayıcı aynı origin POST'ta da Origin gönderir;
 *     listede olmazsa panel kendi API'sine bile yazamaz).
 *  2. Çerezle gelen yazma isteklerinde `Origin == PUBLIC_WEB_ORIGIN` kontrolü (CSRF 2. katman).
 *  3. RESTAURANT/ADMIN şifre sıfırlama bağlantısı (`/panel/sifre-sifirla`).
 *
 * Değer her çağrıda env'den okunur (modül yüklenirken dondurulmaz) → testler env'i
 * değiştirebilir. Origin karşılaştırması tam eşitliktir; burada yalnızca sondaki `/`
 * atılır ki "https://x.app/" yazımı sessizce bütün yazma isteklerini reddetmesin.
 */

function normalizeOrigin(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().replace(/\/+$/, '');
  return v.length ? v : null;
}

/** @returns {string|null} Normalleştirilmiş origin ya da tanımsızsa null. */
function getPublicWebOrigin(env = process.env) {
  return normalizeOrigin(env.PUBLIC_WEB_ORIGIN);
}

/** `ALLOWED_ORIGINS` (virgüllü) + `PUBLIC_WEB_ORIGIN`, tekrarsız. */
function buildAllowedOrigins(env = process.env) {
  const list = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const web = getPublicWebOrigin(env);
  if (web && !list.includes(web)) list.push(web);
  return list;
}

/**
 * `PUBLIC_WEB_ORIGIN` geçerli bir origin mi (şema + host, yol/sorgu yok)?
 * validateEnv bunu üretimde zorunlu kılar.
 */
function isValidOrigin(value) {
  const v = normalizeOrigin(value);
  if (!v) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === v;
  } catch {
    return false;
  }
}

module.exports = { getPublicWebOrigin, buildAllowedOrigins, isValidOrigin, normalizeOrigin };
