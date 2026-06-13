'use strict';

/**
 * Yük testi production-guard (S16-9).
 *
 * Yük testi YALNIZCA staging'e koşulmalı — production endpoint'ini dövmek gerçek
 * maliyet (Anthropic/Google) + gerçek kullanıcı etkisi yaratır. Bu modül saf JS'tir
 * (k6 importu yok) → hem k6 scriptlerinden `import` edilir hem jest ile test edilir.
 */

// Bilinen production host'ları (kazara koşumu engelle).
const PRODUCTION_HOSTS = [
  'railway-up-production-6cdc.up.railway.app',
];

/** Verilen URL/host production'a mı işaret ediyor? */
function isProductionUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  if (PRODUCTION_HOSTS.some((h) => lower.includes(h))) return true;
  // Genel güvenlik ağı: host'unda "production"/"prod." geçen hedefleri de production say.
  return /\bprod(uction)?\b/.test(lower) || lower.includes('.prod.');
}

/**
 * Hedef BASE_URL'i çözer ve guard uygular.
 * - BASE_URL zorunlu (production'a kazara default YOK).
 * - production hedefi → yalnızca ALLOW_PRODUCTION='true' ile (bilinçli kaçış).
 * @param {Record<string,string>} env  k6 `__ENV` veya process.env
 * @returns {string} güvenli BASE_URL
 * @throws guard ihlalinde
 */
function resolveTarget(env = {}) {
  const baseUrl = env.BASE_URL;
  if (!baseUrl) {
    throw new Error('[guard] BASE_URL zorunlu (ör. BASE_URL=https://staging.example). Production\'a kazara koşumu önlemek için default yok.');
  }
  if (isProductionUrl(baseUrl) && env.ALLOW_PRODUCTION !== 'true') {
    throw new Error(`[guard] Hedef production görünüyor (${baseUrl}). Yük testi staging'e koşulmalı. Gerçekten istiyorsan ALLOW_PRODUCTION=true ile çalıştır.`);
  }
  return baseUrl.replace(/\/+$/, '');
}

module.exports = { isProductionUrl, resolveTarget, PRODUCTION_HOSTS };
