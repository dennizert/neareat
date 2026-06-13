import http from 'k6/http';
import { check, sleep } from 'k6';
import { resolveTarget } from '../lib/guard.js';

/**
 * Tarama (browse) yük senaryosu — S16-9.
 * Keşfet/nearby + arama + health. Auth/AI maliyeti YOK; nearby sabit koordinatla
 * çağrılır → ilk istekten sonra Redis cache'inden döner (Google maliyeti minimum).
 *
 * Çalıştırma:
 *   k6 run -e BASE_URL=https://staging.example load-tests/k6/browse.js
 *   k6 run -e BASE_URL=... -e VUS=500 -e RAMP=1m -e HOLD=3m load-tests/k6/browse.js
 */

const BASE = resolveTarget(__ENV);
const VUS = Number(__ENV.VUS || 200);
const LAT = __ENV.LAT || '41.0082';
const LNG = __ENV.LNG || '28.9784';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '30s', target: VUS },
        { duration: __ENV.HOLD || '1m', target: VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Kapasite kabul eşikleri (S16-9): hata < %1, p95 < 1.5s (ağır AI hariç).
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function browse() {
  // 1) Health (taban katman)
  const h = http.get(`${BASE}/health`);
  check(h, { 'health 200': (r) => r.status === 200 });

  // 2) Keşfet/nearby (auth opsiyonel; sabit koordinat → cache isabeti)
  const nearby = http.get(`${BASE}/api/restaurants/nearby?lat=${LAT}&lng=${LNG}&type=all`);
  check(nearby, { 'nearby 200': (r) => r.status === 200 });

  sleep(0.5);

  // 3) Serbest metin arama (Text Search; cache'li)
  const search = http.get(`${BASE}/api/places/search?q=pizza`);
  check(search, { 'search 200': (r) => r.status === 200 });

  sleep(1);
}
