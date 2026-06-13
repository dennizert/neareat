/**
 * Arkadaş Önerisi gece job'ı.
 *
 * Her gece 03:00'te (Europe/Istanbul) tüm aktif kullanıcılar için uyum bazlı
 * arkadaş önerilerini hesaplar ve Redis'e yazar (friendSuggestionService).
 * Endpoint bu precompute sonucunu okur; cache miss'te anlık hesaplar.
 * Admin panelinden manuel de tetiklenebilir.
 */

const cron = require('node-cron');
const { computeAllSuggestions } = require('../services/friendSuggestionService');
const { withCronLock } = require('../services/cronLock');

async function runFriendSuggestionsJob() {
  const start = Date.now();
  try {
    const { processed, stored } = await computeAllSuggestions();
    console.log(`[friendSuggestions] ${stored}/${processed} kullanıcı için öneri üretildi (${Date.now() - start}ms)`);
    return { processed, stored };
  } catch (err) {
    console.error('[friendSuggestions] error:', err.message);
    return { processed: 0, stored: 0, error: err.message };
  }
}

function scheduleFriendSuggestions() {
  // Her gece 03:00 — Türkiye saati
  cron.schedule('0 3 * * *', () => withCronLock('friendSuggestions', runFriendSuggestionsJob), { timezone: 'Europe/Istanbul' });
}

module.exports = { scheduleFriendSuggestions, runFriendSuggestionsJob };
