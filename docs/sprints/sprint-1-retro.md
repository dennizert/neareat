# Sprint-1 Retrospektifi — AI Yemek Önerisi v1

**Sprint adı:** Sprint-1: AI Yemek Önerisi v1
**Başlangıç:** 2026-05-20 (planlama + Task #1)
**Bitiş:** 2026-05-20 (Task #11)
**Milestone:** [Sprint-1: AI Yemek Onerisi v1](https://github.com/dennizert/neareat/milestone/1)
**Task'lar:** 11 GitHub issue (#1-#11), her biri ayrı PR ile

---

## Hedef

NearEat'e Claude API ile çalışan kişisel yemek öneri motoru eklemek. "Bu akşam ne yesem?" sorusuna kullanıcının yorum/favori geçmişi + mevcut konumu + opsiyonel mood'a göre 1-3 kişisel öneri vermek.

## Sonuç: ✅ TAMAMLANDI

Hedeflenen 11 task'ın hepsi merge edildi (PR #12-#21 + #11 docs PR). Production'a deploy bekliyor (manuel adımlar).

---

## Ne yapıldı?

### Backend
- **DB schema** (#1): `User.shareWithFriendsRecommender` opt-in field + `AiRecommendationLog` audit tablosu
- **Anthropic SDK** (#2): `@anthropic-ai/sdk@^0.97.1` kurulum, lazy client, pricing tablosu, helper fonksiyonlar
- **candidateService** (#3): Google Places (Redis cached) + DB user history → max 20 aday + 5-bileşenli skorlama
- **promptBuilder** (#4): 3500-token system prompt + deterministik user profile summary + 2 cache breakpoint
- **POST `/api/recommendations/dinner-tonight`** (#5): auth + validation + tier + rate limit + halüsinasyon filtresi + audit log
- **Test suite** (#6): 73 unit + 25 integration test, Anthropic mock'lu, +98 toplam test

### Mobile
- **API service + Zustand store** (#7): `getDinnerRecommendation()`, `AiRecommendationLimitError`, store actions
- **RecommendationScreen + Card + HomeScreen CTA** (#8): mood seçici, 3 kart, error states, navigation
- **Profile arkadaş paylaşım toggle** (#9): `shareWithFriendsRecommender` opt-in Switch + backend update endpoint
- **PremiumUpsellScreen** (#10): AI-specific paywall + reset countdown + auto-navigate on 429

### Dokümantasyon
- **Bu PR** (#11): README AI bölümü, memory dosyaları, TEST_SCENARIOS, retro

## Sayılar

| Metrik | Sprint öncesi | Sprint sonu | Δ |
|---|---|---|---|
| Backend test sayısı | 342 | **440** | **+98** |
| Mobile test sayısı | 82 | **97** | **+15** |
| Production endpoint sayısı | ~50 | ~51 | +1 |
| LOC (recommender-spesifik) | 0 | ~3500 | +3500 |
| PR sayısı | — | **10** | — |

### Coverage (Sprint-1 recommendation* files)
- `recommendationController.js`: **97.67%**
- `candidateService.js`: **100%**
- `promptBuilder.js`: **82.97%**
- `recommendationService.js`: **93.82%**

## Smoke test sonuçları (gerçek Anthropic API)

| Test | Sonuç |
|---|---|
| Prompt cache write (Haiku 4.5) | ✓ 5977 token cache'lendi |
| Prompt cache read (5dk içinde) | ✓ 5977 token cache'den okundu |
| Maliyet tasarrufu | %52 (0.0127$ → 0.0061$) |
| E2E endpoint (free user 4. call) | ✓ 429 LIMIT_EXCEEDED |
| AiRecommendationLog audit | ✓ 3 row başarıyla yazıldı |
| Latency | 9-11sn (hedef <5sn — Sprint-2'ye taşındı) |

---

## İyi giden şeyler

### 1. Atomik task → branch → PR → merge döngüsü çok temiz çalıştı
Her task ayrı `feature/issue-N-...` branch'inde, her birine PR + review + merge. 11 task = 10 PR (Task #1-#10 ayrı, #11 bu retro PR'ı). User merge ettikten sonra master pull → bir sonraki branch açma akışı pürüzsüzdü.

### 2. Skill kullanımı isabetliydi
`claude-api` skill'i Task #4 başında invoke ettik. Yüklendiğinde **Haiku 4.5'in 4096 token cache threshold'unu** öğrendik — bu olmasa system prompt'u 2000 tokende bırakırdık ve cache silent fail olurdu (no error, just no caching).

### 3. Defensive coding her seferinde işe yaradı
- `parseLlmJson` code fence + preamble + postamble strip ile gerçek LLM çıktısının %5'inin formatı bozuk olsa bile handle ediyor
- Halüsinasyon filtresi (placeId aday listede mi?) hiç aktive olmadı testlerde ama production'da kritik olacak
- Audit log fail tolerance: DB write hata atsa bile recommendation flow durmuyor

### 4. Test-first refleksi
Task #6'da 98 test yazarken mevcut testlerin **sessizce kırık** olduğunu keşfettik (Resend SDK module-load throw). Setup fix'i bir bonus düzeltme oldu. Bu olmasa #7-#10'da CI'da kırılma yaşardık.

### 5. Mimari kararların kalıcılığı
- `AiRecommendation*` prefix kararı Task #1'de alındı, Task #7-#10'da tutarlı uygulandı (model adı, store adı, service adı, screen adı)
- 2-tier model split (Haiku/Sonnet) sprint başında kararlaştırıldı, retrospective'de değiştirme ihtiyacı duyulmadı

---

## Zorlandığımız yerler

### 1. Eski migration shadow DB'yi kırıyor
`20260511120000_add_messages_and_reports` `reporter_id` FK'ye referans veriyor ama o kolonu oluşturmuyor. Şu yöntemle çözdük (package.json `start` script'i de aynı pattern):
```bash
prisma migrate resolve --applied 20260511120000_add_messages_and_reports
prisma migrate deploy
```

**Sonraki sprint için:** Bu broken migration'ı temizleyen bir cleanup PR atılmalı veya başlık etiketi (`KEEP --applied`) eklenmeli.

### 2. Latency hedefi karşılanamadı
Issue AC `<5sn` diyordu ama gerçek **9-11sn**:
- Google Places ilk fetch ~5sn (2× pagination delay)
- Anthropic Haiku call ~3-5sn

Redis cache + prompt cache 2. çağrıda devreye giriyor ama Google overhead persist ediyor. **Sprint-2 öncelik:** candidateService single-page fast mode.

### 3. UI test ortamı yok
Expo dev server bu Claude oturumundan başlatılamıyor — UI değişiklikleri (Task #8, #9, #10) için her PR'da "reviewer görsel doğrulayacak" notu eklemek zorunda kaldık. TypeScript + jest store tests bir miktar güven veriyor ama componentlerin gerçek render davranışı kullanıcı görmeden bilinmiyor.

### 4. Scope drift — Task #3
Issue body "Prisma query" diyordu ama NearEat'te Restaurant tablosu yok (Google Places API live). Task #3'ü Google Places + DB hibrit'e adapte etmek için ~30 dk extra düşünce zamanı. Issue oluşturulurken mimari daha iyi okunmuş olsa bu olmazdı.

### 5. Sprint planlaması sırasında "yeni kullanıcı" senaryosu eksik düşünüldü
Test user boş profilli olunca Haiku cache silent fail oluyordu (sadece 200 token profile). System prompt'u ~3500 token'a uzatarak çözdük — ama bu fark Task #4'te late discovery oldu. **Sonraki sprint:** Cold start senaryolarını planlama aşamasında listele.

---

## Sürprizler / Keşifler

### 1. Resend SDK module-load fail
Mevcut tests'lerin **silent fail** olduğunu Task #6'da keşfettik. `tests/setup.js` `RESEND_API_KEY` set etmiyordu, Resend v6 `new Resend(undefined)` ile throw atıyordu. Memory'deki "342 test pass" gerçek ortamda doğru değildi.

### 2. Prompt caching maliyet etkisi beklediğimizden büyük
Skill ~%80-90 demişti, biz Haiku'da %52 ölçtük. Sebep: our profile bloğu küçüktü (test user boş). Production'da aktif kullanıcılarla %75+ bekleniyor.

### 3. Anthropic SDK Node.js'in TypeScript-style imports JS'te de çalışıyor
`require('@anthropic-ai/sdk')` direkt class döner, instantiate edilebiliyor. Geleneksel CommonJS pattern çalıştı, ek build adımı gerekmedi.

### 4. `class extends Error` TypeScript gotcha
`AiRecommendationLimitError` `instanceof` check kırılıyordu. `Object.setPrototypeOf(this, X.prototype)` ile çözdük — TypeScript SDK boilerplate ile karşılaşan tek yer.

---

## Sprint-2 backlog (öncelik sırası)

1. **Latency optimizasyonu** ([yüksek]) — single-page Google Places fetch, async audit log, streaming response
2. **Production deploy** ([yüksek]) — Railway env `ANTHROPIC_API_KEY` + migration sırası
3. **Arkadaş sinyali prompt'a entegrasyonu** ([orta]) — Task #9'da opt-in field eklendi ama henüz `buildUserProfileSummary` arkadaş verisini çekmiyor
4. **Restaurant photo enrichment** ([orta]) — RecommendationCard'da `photoUrl` yok; Place Details paralel fetch ekle
5. **Feedback loop** ([orta]) — 👍/👎 butonları + `RecommendationFeedback` tablosu (Task #11'in v4 olarak listelendiği item)
6. **Rota üzerinde öneri** ([düşük]) — v2 hedefi; Directions API + buffer
7. **Grup önerisi** ([düşük]) — v3 hedefi; 3+ arkadaş kesişimi
8. **Eski broken migration cleanup** ([düşük teknik borç]) — `add_messages_and_reports` repo'dan kaldır + lock güncellenmeli
9. **Component render tests** ([orta teknik borç]) — react-test-renderer veya detox ekle
10. **Cuisine mapping genişlet** ([düşük]) — şu an 16 mapping; Türk damak zevki için 30+ alt kategori (kebap, mantı, lokanta, vs)

---

## Production deploy checklist (Sprint-2 başında)

- [ ] Railway dashboard → environment variables → `ANTHROPIC_API_KEY=sk-ant-...` ekle
- [ ] Railway production console → migration:
  ```bash
  npx prisma migrate resolve --applied 20260511120000_add_messages_and_reports
  npx prisma migrate deploy
  ```
- [ ] Health check: `POST /api/recommendations/dinner-tonight` test user'la 200 dönüyor mu
- [ ] Console.anthropic.com → billing & usage dashboard kontrolü
- [ ] Mobile app `BACKEND_URL` zaten production'a bakıyor (`railway-up-production-6cdc.up.railway.app`)
- [ ] EAS build (next mobile release): Task #8, #9, #10 değişikliklerini içerir

---

## Workflow değerlendirmesi

**Sprint workflow başarısı (kullanıcı talebi):**
> "Bundan sonra yapacağın her şeyi önce planlayacak ve task oluşturarak parça parça böleceksin. Bu tasklarla sprint oluşturacaksın. Bunları Git üzerinden yöneteceksin."

**Sonuç:** 11 task'ın 11'i ayrı PR olarak gitti. Her PR ayrı review aldı, ayrı commit history. Sprint-1 = `feature/issue-1-*` ile başlayan 10 PR + bu retro PR'ı.

**Bundan sonra:**
- Aynı pattern devam edecek ([[feedback-workflow]] memory'sinde belgeli)
- Her sprint öncesi planlama → milestone + 6-12 atomik issue
- Issue body'lerinde scope clear olsun, mimari sürprizleri minimize et
- Task #1 her zaman DB/foundational layer olsun (#1'in mimariyi netleştirmesi sonraki task'ları kolaylaştırdı)

---

**Retro yazarı:** Claude (Opus 4.7)
**Son güncellenme:** 2026-05-20
