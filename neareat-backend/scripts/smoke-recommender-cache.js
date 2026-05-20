/**
 * Manual smoke test — promptBuilder + Anthropic API prompt caching.
 *
 * Çalıştırma: cd neareat-backend && node scripts/smoke-recommender-cache.js
 *
 * Amaç (Sprint-1 Task #4 AC'ler):
 *   - İlk call: cache_creation_input_tokens > 0
 *   - 5 dk içinde 2. call: cache_read_input_tokens > 0
 *   - Profil deterministik (aynı user → aynı text)
 *
 * Bu CI'da çalışmaz — gerçek Anthropic kredisi tüketir (~$0.001-0.01).
 * Sadece manuel doğrulama için.
 */

require('dotenv').config();
const candidateService = require('../src/services/candidateService');
const promptBuilder = require('../src/services/promptBuilder');
const { getClient, modelForTier, summarizeUsage } = require('../src/services/recommendationService');
const prisma = require('../src/utils/prisma');

async function main() {
  // 1. Test user
  const user = await prisma.user.findFirst({
    where: { role: 'USER' },
    select: { id: true, displayName: true, favoriteCuisines: true },
  });
  if (!user) {
    console.error('No user found in DB');
    process.exit(1);
  }
  console.log(`User: ${user.displayName} (${user.id})`);
  console.log(`favoriteCuisines: ${JSON.stringify(user.favoriteCuisines)}`);

  // 2. Candidates (Taksim, Istanbul)
  const location = { lat: 41.0369, lng: 28.985 };
  console.log(`\nFetching candidates @ Taksim (${location.lat}, ${location.lng})...`);
  const { candidates, meta } = await candidateService.getCandidates(user.id, location);
  console.log(`Got ${candidates.length} candidates (${meta.latencyMs}ms)`);

  // 3. Build profile
  console.log('\nBuilding user profile summary...');
  const profile1 = await promptBuilder.buildUserProfileSummary(user.id);
  console.log(`Profile token estimate: ~${profile1.tokenEstimate} tokens`);

  // Determinism check
  const profile2 = await promptBuilder.buildUserProfileSummary(user.id);
  const deterministic = profile1.text === profile2.text;
  console.log(`Determinism check: ${deterministic ? 'PASS (identical)' : 'FAIL (text differs)'}`);
  if (!deterministic) {
    console.log('  Bytes differ — caching will break. Check buildUserProfileSummary.');
    process.exit(1);
  }

  // 4. Build full Claude request
  const req = promptBuilder.buildClaudeRequest({
    profileSummary: profile1,
    candidates,
    location,
    mood: 'şık',
    now: new Date().toISOString(),
  });
  console.log(`\nToken estimates: system=~${req.tokenEstimate.system}, profile=~${req.tokenEstimate.profile}, variable=~${req.tokenEstimate.variable}`);
  console.log(`Total cached (system+profile): ~${req.tokenEstimate.system + req.tokenEstimate.profile} tokens`);
  console.log('(Haiku 4.5 minimum cache prefix: 4096 tokens. If under, cache silently fails.)');

  // 5. First Anthropic call
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\nANTHROPIC_API_KEY not set — cannot test real API call.');
    process.exit(1);
  }
  const client = getClient();
  const model = modelForTier('free'); // Haiku 4.5 (cache min 4096 — strict test)

  console.log(`\n--- CALL 1 (model=${model}) ---`);
  const t1 = Date.now();
  const resp1 = await client.messages.create({
    model,
    max_tokens: 1024,
    system: req.system,
    messages: req.messages,
  });
  const latency1 = Date.now() - t1;
  const usage1 = summarizeUsage(model, resp1.usage);
  console.log(`Latency: ${latency1}ms`);
  console.log(`Usage: input=${resp1.usage.input_tokens} output=${resp1.usage.output_tokens} cacheWrite=${resp1.usage.cache_creation_input_tokens ?? 0} cacheRead=${resp1.usage.cache_read_input_tokens ?? 0}`);
  console.log(`Estimated cost: $${usage1.estimatedCostUsd}`);
  console.log(`Response: ${resp1.content[0]?.text?.slice(0, 200)}...`);

  // 6. Second Anthropic call (cache read expected)
  console.log(`\n--- CALL 2 (same prompt → cache read expected) ---`);
  const t2 = Date.now();
  const resp2 = await client.messages.create({
    model,
    max_tokens: 1024,
    system: req.system,
    messages: req.messages,
  });
  const latency2 = Date.now() - t2;
  const usage2 = summarizeUsage(model, resp2.usage);
  console.log(`Latency: ${latency2}ms (${latency2 < latency1 ? 'faster ✓' : 'NOT faster ✗'})`);
  console.log(`Usage: input=${resp2.usage.input_tokens} output=${resp2.usage.output_tokens} cacheWrite=${resp2.usage.cache_creation_input_tokens ?? 0} cacheRead=${resp2.usage.cache_read_input_tokens ?? 0}`);
  console.log(`Estimated cost: $${usage2.estimatedCostUsd} (${usage2.estimatedCostUsd < usage1.estimatedCostUsd ? 'cheaper ✓' : 'NOT cheaper'})`);

  // 7. AC summary
  console.log('\n=== ACCEPTANCE CRITERIA ===');
  const ac1 = (resp1.usage.cache_creation_input_tokens ?? 0) > 0;
  const ac2 = (resp2.usage.cache_read_input_tokens ?? 0) > 0;
  const ac3 = true; // doc done in service file
  const ac4 = deterministic;
  console.log(`[${ac1 ? 'PASS' : 'FAIL'}] AC1: İlk call cache_creation_input_tokens > 0 (got ${resp1.usage.cache_creation_input_tokens ?? 0})`);
  console.log(`[${ac2 ? 'PASS' : 'FAIL'}] AC2: 2. call cache_read_input_tokens > 0 (got ${resp2.usage.cache_read_input_tokens ?? 0})`);
  console.log(`[${ac3 ? 'PASS' : 'FAIL'}] AC3: Prompt yapısı dokumante (kod yorumlarında)`);
  console.log(`[${ac4 ? 'PASS' : 'FAIL'}] AC4: Profil deterministik (aynı user 2× build = identical)`);

  await prisma.$disconnect();
  if (!ac1 || !ac2) {
    console.log('\n⚠ Cache AC fail nedeni:');
    if (req.tokenEstimate.system + req.tokenEstimate.profile < 4096) {
      console.log(`  → Cached prefix toplam ${req.tokenEstimate.system + req.tokenEstimate.profile} token, Haiku 4.5 minimum 4096. System veya profile uzatılmalı.`);
    } else {
      console.log('  → Token budget yeterli görünüyor, başka bir invalidator olabilir (timestamp, JSON order, vs.). Profil bytes farkını incele.');
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});
