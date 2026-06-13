'use strict';

/**
 * Hazır-olma (readiness) durumu — S16-8 yatay ölçekleme / rolling deploy.
 *
 * Graceful shutdown başladığında `setShuttingDown(true)` çağrılır; `/health` bunu
 * görünce 503 döner. Böylece yük dengeleyici (Railway/LB) kapanmakta olan replikaya
 * YENİ istek yönlendirmeyi bırakır ve mevcut bağlantılar drain edilirken 5xx artışı
 * minimumda kalır. Modül düzeyinde tutulur → test edilebilir (app listen'ından bağımsız).
 */

let shuttingDown = false;

function isShuttingDown() {
  return shuttingDown;
}

function setShuttingDown(value) {
  shuttingDown = !!value;
}

module.exports = { isShuttingDown, setShuttingDown };
