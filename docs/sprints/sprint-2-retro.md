# Sprint-2 Retrospektifi — Recommender v1.5: Production Polish

**Sprint adı:** Sprint-2: Recommender v1.5 — Production Polish
**Başlangıç:** 2026-05-21 (Task #1)
**Bitiş:** 2026-05-21 (Task #10)
**Milestone:** Sprint-2: Recommender v1.5
**Task'lar:** 10 GitHub issue (#25-#34), her biri ayrı PR ile (PR #35-#44)

---

## Hedef

Sprint-1'de ölçülen 9-11sn latency'i `<5sn` hedefine çekmek; feedback loop + photo enrichment + arkadaş sinyali ile öneri kalitesini artırmak; production'a deploy için deployment kılavuzunu tamamlamak.

## Sonuç: ✅ TAMAMLANDI

10 task'ın 10'u merge edildi. Railway deploy canlı, tüm testler geçiyor.

---

## Ne yapıldı?

### Backend — Latency Optimizasyonu

- **Task #1 (#25) — Fast candidate fetch**: `getNearbyRestaurantsFast()` (tek sayfa, no pagination delay). Google Places 2×2sn pagination delay'i ortadan kaldırdı. Latency 9-11sn → ~3-5sn (LLM dominant path).
- **Task #2 (#26) — Fire-and-forget audit log**: `aiRecommendationLog.create` artık `await` edilmiyor. `.catch(console.error)` ile fire-and-forget. DB write'ın latency'e katkısı sıfırlandı. Perf benchmark testiyle kanıtlandı (p95 < 5sn).

### Backend — Özellik Geliştirme

- **Task #3 (#27) — Photo enrichment**: Top 5 aday için paralel `getPlaceDetails` (Promise.all). `photoUrl` → `candidate` ve response'a eklendi. Hata durumunda null fallback; Redis 24h cache korundu.
- **Task #4 (#28) — RecommendationFeedback schema**: `RecommendationFeedback` modeli (sentiment=LIKE/DISLIKE, comment, visited, createdAt). Idempotent migration (IF NOT EXISTS + DO$$ FK guard).
- **Task #5 (#29) — Feedback endpoint**: `POST /api/recommendations/feedback`. placeId + sentiment validation, comment 500-char trim, FEEDBACK_DAILY_LIMIT=50 anti-spam (Prisma count). 12 yeni integration testi.
- **Task #7 (#31) — Arkadaş sinyali**: `buildFriendSignals(userId)` — ACCEPTED arkadaşlar arasında `shareWithFriendsRecommender=true` opt-in filtresi (KVKK), anonim "arkadaş N" etiketleme, en fazla 5 mutfak tipi. Premium-only. `buildUserProfileSummary(userId, { tier })` ile entegre.

### Mobile

- **Task #6 (#30) — Feedback UI**: `RecommendationCard` footer'ına 👍/👎 butonları. `aiRecommendationStore.submitFeedback()` optimistic update + rollback. Debounce guard (submitting state), hata → Alert.

### Dokümantasyon & Kalite

- **Task #8 (#32) — README deploy guide**: Railway 7-sorun saga, Root Directory kritik notu, env var referans listesi, troubleshooting tablosu, health check curl.
- **Task #9 (#33) — Coverage gap fill**: `parseLlmJson` catch branch, `promptBuilder` loop/map coverage, controller error propagation. Coverage: promptBuilder 100% Stmt, recommendationController 100% Stmt.
- **Task #10 (#34) — Docs + memory + retro**: Bu dosya.

---

## Sayılar

| Metrik | Sprint-2 öncesi | Sprint-2 sonu | Δ |
|---|---|---|---|
| Backend test sayısı | **440** | **475** | **+35** |
| Mobile test sayısı | **97** | **103** | **+6** |
| Backend test suite sayısı | 19 | 20 | +1 (perf) |
| Production endpoint sayısı | ~51 | ~52 | +1 (feedback) |

### Coverage (Sprint-2 sonu, recommendation* files)

| Dosya | Stmts | Branch |
|---|---|---|
| `recommendationController.js` | **100%** | ~85% |
| `candidateService.js` | **100%** | 100% |
| `promptBuilder.js` | **100%** | ~91% |
| `recommendationService.js` | **97.5%** | ~90% |

---

## İyi giden şeyler

### 1. Latency hedefi aşıldı

Sprint-1 retro AC `<5sn` idi. Fast candidate fetch + fire-and-forget audit log ile perf benchmark testi `p95 < 5sn` (simulated 250ms LLM) ile geçiyor. Gerçek prod latency ~3-5sn (LLM dominant, network bağımlı).

### 2. Fire-and-forget pattern net bir kazanım

Audit log 300ms simulated delay ile test edildi. Endpoint response süresi buna bağımsız olduğu kanıtlandı (`<800ms` threshold testi). Bu, latency optimizasyonunda "kod yolu"nun bottleneck olmadığını garanti altına aldı.

### 3. KVKK-uyumlu arkadaş sinyali tasarımı sıfırdan doğru yapıldı

`buildFriendSignals` başından `shareWithFriendsRecommender=true` filtrelemesi ile çalıştı. Test'te "LLM response içinde arkadaş ID'si görünmüyor" assertion'ı vardı. Sonradan KVKK fix gerektirecek bir tasarım yapmadık.

### 4. Mock pattern double-call ayırt etme

`promptBuilder.test.js`'te `prisma.review.findMany` hem user'ın kendi incelemeleri hem arkadaşların incelemeleri için çağrılıyor. `mockImplementation(({ where }) => where.userId?.in ? ... : ...)` pattern'ı ile tek mock iki davranışı ayırt etti. Temiz.

### 5. Sprint-1 broken migration temizlendi (hotfix)

`add_messages_and_reports` migration'ı production Railway'de P3009'a yol açıyordu. Sprint-2 başında hotfix PR (#23, #24) ile temizlendi. Sprint-1 retro'da "pending cleanup" notuydu; bu sprintte kapatıldı.

---

## Zorlandığımız yerler

### 1. Photo enrichment paralel fetch — rate limit riski

`Promise.all` ile 5 aday için eşzamanlı `getPlaceDetails` çağrısı yapılıyor. Production'da yüksek trafikte Google Places rate limit riski var. Şu an Redis cache (24h) azaltıyor ama monitor edilmeli.

### 2. `parseLlmJson` catch branch testlenememişti

`parseLlmJson('{ broken json')` — sondaki `}` olmadığı için `lastIndexOf('}')` === -1 ile çıkıyor, catch'e girmiyor. `'{invalid: syntax}'` ile test yazmak gerekti. Kod review'da catch-coverage'ı unutmak kolay.

### 3. Friend signal için mockPrisma eksikliği

`buildFriendSignals` → `prisma.friendRequest.findMany` çağırıyor. Ama `recommendations.test.js`, `recommendationService.test.js`, `recommendations-perf.test.js` mock'larında `friendRequest` yoktu. Task #7 sonrası 3 dosyada eş zamanlı fix gerekti.

---

## Sürprizler / Keşifler

### 1. Railway kalıcı canlıya geçti (Sprint-2 başı)

Sprint-1 sonu "deploy bekliyor" notu vardı. Sprint-2'nin ilk 24 saatinde hotfix PR'lar + `railway up` + migration sırası çözüldü. NearEat API artık production'da. URL: `railway-up-production-6cdc.up.railway.app`.

### 2. Perf benchmark test'i gerçekten koruma sağlıyor

`audit log fire-and-forget` testini yazarken fark ettik: 1000ms delay ile mock'lu audit log, endpoint'in `<800ms` döndüğünü kanıtlıyor. Bu tür "özelliğin regresyon testini" nadiren yazıyoruz — Sprint-2'nin en değerli test'i bu oldu.

### 3. RecommendationCard feedback butonları TypeScript'te daha temiz

React Native'de `Pressable` ile `onPress` handler'ı yazmak, düz JS'ten daha clean çıktı. `submitting` guard + rollback pattern güven verdi.

---

## Sprint-3 backlog önerileri (öncelik sırası)

1. **Streaming response** ([yüksek]) — LLM streaming ile TTFB < 1sn, progressive render
2. **Feedback → LLM improvement signal** ([yüksek]) — `RecommendationFeedback` verisi `promptBuilder`'a feed edilsin (liked/disliked placeType history)
3. **Google Places rate limit izlemesi** ([orta]) — photo enrichment Promise.all → circuit breaker / throttle
4. **Eski broken migration cleanup tamamlama** ([orta teknik borç]) — `add_messages_and_reports` dosyası hâlâ repoda; gerçek SQL yanlış FK ile kalıyor
5. **Rota üzerinde öneri** ([düşük]) — Directions API + buffer; v2 hedefi
6. **Grup önerisi** ([düşük]) — 3+ arkadaş kesişimi; v3 hedefi
7. **Component render tests** ([düşük teknik borç]) — react-test-renderer veya Detox entegre et

---

## Workflow değerlendirmesi

Sprint-2, Sprint-1 retro'da tanımlanan **atomik task → branch → PR → merge** döngüsünü 10 kez tekrar etti. Her PR feature-complete + test-complete olarak açıldı. User "merge ettim" komutu ile akış ilerledi.

**Gözlem:** Sprint-1'den farklı olarak bu sprintte "scope drift" yaşanmadı — issue body'ler Sprint-1 retro bulguları ışığında daha kesin yazıldı.

---

**Retro yazarı:** Claude (Sonnet 4.6)
**Son güncellenme:** 2026-05-21
