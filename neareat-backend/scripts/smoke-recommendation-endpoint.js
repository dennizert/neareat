/**
 * E2E smoke test — /api/recommendations/dinner-tonight endpoint (Sprint-1 Task #5).
 *
 * Çalıştırma:
 *   1. Server'ı başka terminalde başlat: npm start veya node src/app.js
 *   2. Bu scripti çalıştır: node scripts/smoke-recommendation-endpoint.js
 *
 * Bu CI'da çalışmaz — gerçek Anthropic kredisi tüketir ve canlı server gerektirir.
 *
 * Test ettiğimiz:
 *   - 200 başarılı response shape
 *   - Free user 3 başarılı çağrı sonrası 429 LIMIT_EXCEEDED
 *   - AiRecommendationLog tablosuna kayıt yazılıyor
 *   - Geçersiz body (lat/lng yok) → 400
 *   - Auth yok → 401
 */

require('dotenv').config();
const prisma = require('../src/utils/prisma');
const { signToken } = require('../src/utils/jwt');

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;

async function http(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  let body;
  const text = await res.text();
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function clearTodaysLogs(userId) {
  // İstanbul midnight UTC
  const now = new Date();
  const ist = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  const since = new Date(ist.getTime() - 3 * 60 * 60 * 1000);
  const result = await prisma.aiRecommendationLog.deleteMany({
    where: { userId, requestedAt: { gte: since } },
  });
  return result.count;
}

async function main() {
  // 1. Get free test user
  const user = await prisma.user.findFirst({
    where: { role: 'USER' },
    select: { id: true, displayName: true, email: true },
  });
  if (!user) { console.error('No user'); process.exit(1); }

  // Subscription kontrol — Premium ise testler farklı, free olduğundan emin ol
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const isPremium = sub && ['active', 'trial'].includes(sub.status) && new Date(sub.expiresAt) > new Date();
  console.log(`User: ${user.displayName} (${user.email}) | premium=${isPremium}`);

  // 2. Pre-clean: bugünkü logları sil (tekrar çalıştırılabilirlik)
  const cleaned = await clearTodaysLogs(user.id);
  console.log(`Cleaned ${cleaned} previous AiRecommendationLog entries for today.\n`);

  const token = signToken(user.id);
  const authHeader = { Authorization: `Bearer ${token}` };
  const taksim = { lat: 41.0369, lng: 28.985 };

  // 3. Auth yoksa 401
  console.log('--- TEST 1: No auth → 401 ---');
  const t1 = await http('/api/recommendations/dinner-tonight', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taksim),
  });
  console.log(`Status: ${t1.status}  | ${t1.status === 401 ? 'PASS' : 'FAIL'}`);

  // 4. Geçersiz body → 400
  console.log('\n--- TEST 2: Invalid body (no lat/lng) → 400 ---');
  const t2 = await http('/api/recommendations/dinner-tonight', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({}),
  });
  console.log(`Status: ${t2.status}  | ${t2.status === 400 ? 'PASS' : 'FAIL'}  body=${JSON.stringify(t2.body)}`);

  // 5. İlk 3 başarılı çağrı
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- TEST 3.${i}: Call ${i}/3 (free limit, expect 200) ---`);
    const r = await http('/api/recommendations/dinner-tonight', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ ...taksim, mood: 'şık' }),
    });
    if (r.status !== 200) {
      console.log(`Status: ${r.status}  | FAIL  body=${JSON.stringify(r.body).slice(0, 300)}`);
      continue;
    }
    console.log(`Status: 200  | PASS`);
    console.log(`  tier=${r.body.tier} model=${r.body.model} remaining=${r.body.remainingToday} latency=${r.body.latencyMs}ms`);
    console.log(`  recs=${r.body.recommendations.length}`);
    if (r.body.recommendations[0]) {
      const rec = r.body.recommendations[0];
      console.log(`  → ${rec.restaurant.name} (${rec.restaurant.distanceKm}km, ${rec.restaurant.rating}★)`);
      console.log(`     "${rec.reason.slice(0, 120)}..."`);
    }
  }

  // 6. 4. çağrı → 429 LIMIT_EXCEEDED
  console.log('\n--- TEST 4: Call 4/3 (over limit) → 429 ---');
  const t4 = await http('/api/recommendations/dinner-tonight', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(taksim),
  });
  const ac429 = t4.status === 429 && t4.body?.error === 'LIMIT_EXCEEDED';
  console.log(`Status: ${t4.status}  | ${ac429 ? 'PASS' : 'FAIL'}  upgrade=${t4.body?.upgrade}`);

  // 7. Audit log doğrulaması
  console.log('\n--- TEST 5: AiRecommendationLog audit ---');
  const todayLogs = await prisma.aiRecommendationLog.count({
    where: {
      userId: user.id,
      requestedAt: { gte: new Date(new Date(Date.now() + 3 * 60 * 60 * 1000).setUTCHours(0, 0, 0, 0) - 3 * 60 * 60 * 1000) },
    },
  });
  console.log(`Today's AiRecommendationLog rows: ${todayLogs}  | expected 3, ${todayLogs === 3 ? 'PASS' : 'FAIL'}`);

  // 8. Cleanup
  await clearTodaysLogs(user.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('SMOKE FAILED:', e);
  await prisma.$disconnect();
  process.exit(1);
});
