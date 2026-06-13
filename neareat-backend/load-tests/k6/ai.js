import http from 'k6/http';
import { check, sleep } from 'k6';
import { resolveTarget } from '../lib/guard.js';

/**
 * AI öneri yük senaryosu — S16-9. **MALİYET UYARISI:** her gerçek istek Anthropic
 * harcar. Bu senaryo bilinçli olarak ÇOK DÜŞÜK yükle koşar (varsayılan 3 VU, kısa)
 * ve S16-3 günlük tavanına saygılıdır. Tercihen staging'de Anthropic mock/sandbox
 * ile koş (sıfır maliyet). Yüksek eşzamanlılık ölçmek istersen önce mock'la.
 *
 * Çalıştırma (düşük, gerçek):
 *   k6 run -e BASE_URL=https://staging.example -e TOKEN=<jwt> load-tests/k6/ai.js
 */

const BASE = resolveTarget(__ENV);
const TOKEN = __ENV.TOKEN;
const VUS = Number(__ENV.VUS || 3); // bilinçli düşük — maliyet kontrolü
const LAT = Number(__ENV.LAT || 41.0082);
const LNG = Number(__ENV.LNG || 28.9784);

if (!TOKEN) {
  throw new Error('[ai] TOKEN (JWT) zorunlu. Maliyet için VU düşük tutulur.');
}

export const options = {
  scenarios: {
    ai: {
      executor: 'constant-vus',
      vus: VUS,
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function ai() {
  // Non-stream uç (JSON); S16-3 yanıt cache'i tekrar isteklerde Claude'a gitmez.
  const res = http.post(
    `${BASE}/api/recommendations/dinner-tonight`,
    JSON.stringify({ lat: LAT, lng: LNG }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }, tags: { name: 'ai' }, timeout: '30s' },
  );
  // 200 (öneri/cache) veya 429 (limit/tavan) kabul; 5xx başarısızlık.
  check(res, { 'ai not 5xx': (r) => r.status < 500 });
  sleep(2);
}
