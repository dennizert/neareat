/**
 * Konuşmaya dayalı AI öneri oturumu (Sprint-4 Task #2).
 *
 * Kullanıcı "daha ucuz / daha yakın / daha sessiz" gibi iyileştirme isteği
 * gönderdiğinde önceki önerilerin bağlamı korunmalı. Bağlamı SSE sessionId ile
 * Redis'te tutarız: hangi mekanlar önerildi (tekrar önermemek için) + hangi
 * iyileştirme istekleri geldi (LLM'e geçmişi vermek için).
 *
 * TTL: 30 dk — interaktif bir oturum için yeterli, sonra otomatik temizlenir.
 */

const crypto = require('crypto');
const { cacheGet, cacheSet, cacheDel } = require('./redis');

const SESSION_TTL = 30 * 60; // saniye (30 dk)
const MAX_REFINEMENTS = 10; // güvenlik: sınırsız büyümeyi engelle
const sessionKey = (id) => `rec-session:${id}`;

function newSessionId() {
  return crypto.randomUUID();
}

/**
 * Oturum bağlamını döner. Yoksa veya Redis erişilemezse null.
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
async function getSession(sessionId) {
  if (!sessionId) return null;
  return cacheGet(sessionKey(sessionId));
}

/**
 * Oturum bağlamını TTL ile yazar (upsert).
 * @param {string} sessionId
 * @param {{ userId: string, location: object, suggestedPlaceIds: string[], refinements: string[] }} data
 */
async function saveSession(sessionId, data) {
  await cacheSet(sessionKey(sessionId), data, SESSION_TTL);
}

async function clearSession(sessionId) {
  if (sessionId) await cacheDel(sessionKey(sessionId));
}

module.exports = {
  newSessionId,
  getSession,
  saveSession,
  clearSession,
  sessionKey,
  SESSION_TTL,
  MAX_REFINEMENTS,
};
