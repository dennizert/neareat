import http from 'k6/http';
import { check } from 'k6';
import { resolveTarget } from '../lib/guard.js';

/**
 * Login yük senaryosu — S16-9. bcrypt CPU-bound olduğundan tek çekirdeği en çok
 * zorlayan uçtur; yatay ölçekleme (S16-8) kararı için kritik sinyal.
 *
 * Gerçek bir test hesabı gerekir (staging). authRateLimit (20/15dk/IP) yük testinde
 * tetiklenebilir → düşük VU veya rate-limit'i staging'de gevşetip ölç.
 *
 * Çalıştırma:
 *   k6 run -e BASE_URL=https://staging.example -e EMAIL=test@x.com -e PASSWORD=... \
 *          -e VUS=20 load-tests/k6/login.js
 */

const BASE = resolveTarget(__ENV);
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;
const VUS = Number(__ENV.VUS || 20);

if (!EMAIL || !PASSWORD) {
  throw new Error('[login] EMAIL ve PASSWORD zorunlu (staging test hesabı).');
}

export const options = {
  scenarios: {
    login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '20s', target: VUS },
        { duration: __ENV.HOLD || '40s', target: VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{name:login}': ['p(95)<2000'],
  },
};

export default function login() {
  const res = http.post(
    `${BASE}/api/auth/login/email`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );
  // 200 (başarı) veya 429 (rate-limit) kabul; 5xx başarısızlık.
  check(res, { 'login not 5xx': (r) => r.status < 500 });
}
