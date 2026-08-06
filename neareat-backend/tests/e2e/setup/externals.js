'use strict';

/**
 * Dış servis sahteleri (test double) — E2E paketi.
 *
 * KURAL: yalnızca GERÇEK dış dünya taklit edilir (Google Places, Anthropic, Firebase,
 * Resend, S3). Veritabanı ve Redis taklit EDİLMEZ — onlar sistemin kendi parçası ve
 * yolculuk testinin doğrulamak istediği şey tam da onların birlikte doğru çalışması.
 * (Redis yoksa uygulama zaten fail-open davranır; E2E bu yolu da gerçekçi biçimde kullanır.)
 *
 * TASARIM: sahteler SUSTURMAZ, YAKALAR. Gerçek bir kullanıcı doğrulama e-postasındaki
 * linke tıklar; testin de aynısını yapabilmesi için gönderilen e-postalar `outbox`'ta
 * tutulur ve token'ı çıkarılabilir. Susturulmuş bir e-posta servisi, onboarding
 * yolculuğunu test edilemez hale getirirdi.
 */

/** Gönderilen e-postalar — testler buradan "gelen kutusunu" okur. */
const outbox = { emails: [] };

/** Google Places sahte yanıtları — testler senaryoya göre değiştirebilir. */
const places = {
  nearby: [],
  details: null,
};

/** Anthropic sahte yanıtı — AI öneri akışı için. */
const ai = {
  recommendations: [],
  noteToUser: '',
};

function reset() {
  outbox.emails.length = 0;
  places.nearby = [];
  places.details = null;
  ai.recommendations = [];
  ai.noteToUser = '';
}

/**
 * Belirli bir adrese giden SON e-postayı döndürür.
 * @param {string} email
 */
function lastEmailTo(email) {
  const lower = String(email).toLowerCase();
  return [...outbox.emails].reverse().find((m) => m.to.some((t) => String(t).toLowerCase() === lower)) || null;
}

/**
 * E-posta gövdesindeki doğrulama/sıfırlama token'ını çıkarır — kullanıcının linke
 * tıklamasının test karşılığı.
 * @param {{ html: string }} mail
 * @returns {string|null}
 */
function extractTokenFromEmail(mail) {
  if (!mail?.html) return null;
  const match = mail.html.match(/[?&]token=([A-Za-z0-9-]+)/);
  return match ? match[1] : null;
}

/** Google Places `nearbysearch` sonucu şeklinde sahte bir yer üretir. */
function fakePlace(overrides = {}) {
  const id = overrides.place_id || `place-${Math.random().toString(36).slice(2, 10)}`;
  return {
    place_id: id,
    name: 'Test Restoran',
    vicinity: 'Test Mahallesi, İstanbul',
    geometry: { location: { lat: 41.0082, lng: 28.9784 } },
    rating: 4.5,
    user_ratings_total: 250,
    types: ['restaurant', 'food', 'point_of_interest'],
    business_status: 'OPERATIONAL',
    opening_hours: { open_now: true },
    photos: [{ photo_reference: 'photo-ref-1' }],
    ...overrides,
  };
}

module.exports = { outbox, places, ai, reset, lastEmailTo, extractTokenFromEmail, fakePlace };
