# Sprint-4 Retrospektifi — AI Derinleşmesi + Sosyal Akış

**Sprint adı:** Sprint-4: AI Derinleşmesi + Sosyal Akış
**Başlangıç:** 2026-05-28 (Task #1)
**Bitiş:** 2026-05-29 (Task #8)
**Milestone:** Sprint-4: AI Derinleşmesi + Sosyal Akış (#4)
**Task'lar:** 8 GitHub issue (#66–#73), her biri ayrı PR ile (PR #106–#113 + bu docs PR)

---

## Hedef

`Feature-Plan.md`'deki iki stratejik pilonu hayata geçirmek:

- **AI'ı derinleştir** — tek-adım öneri yetmez: konuşmaya dayalı refinement + feedback döngüsü + sosyal sinyal performansı.
- **Sosyal dinamiği aktifleştir** — arkadaş aktivite akışı (uygulama içi "ısınma", her gün açma sebebi).

---

## Sonuç: ✅ TAMAMLANDI

7 geliştirme task'ı + 1 docs task'ı, 7 PR merge edildi. Mobil suite tamamen yeşil (139/139); backend 563 test geçiyor (35 pre-existing mock hatası — bkz. Sürprizler + issue #110).

---

## Ne yapıldı?

### AI Derinleşmesi

- **S4-1 (#66 / PR #106) — Sosyal sinyal Redis cache**: `buildFriendSignals` çıktısı `social-signals:{userId}` key'inde 15 dk TTL ile cache'lenir. **Bulgu:** issue'daki "N+1" zaten yoktu — kod arkadaş başına sorgu atmıyordu (4 sabit sorgu). Asıl eksik olan cache eklendi.

- **S4-2 (#67 / PR #107) — Konuşmaya dayalı refinement**: Yeni `recommendationSession.js` (Redis `rec-session:{id}`, 30 dk). Streaming endpoint `sessionId` + `refinement` alır; önceki önerilen mekanlar aday listesinden çıkarılır; refinement metni cache'siz variable bloğa enjekte edilir; `done` event'inde `sessionId` döner.

- **S4-3 (#68 / PR #108) — Mobile refinement UI**: `RecommendationScreen` streaming akışına geçirildi; "Daha ucuz / Daha yakın / Daha sessiz" chip'leri + serbest metin. Store'a `sessionId` + `refining` state, eski kartlar ilk yeni kart gelene dek korunur. **Bonus:** bu dosyadaki 6 bozuk stream mock testi (`_mood` imzası) + 1 stale mood testi düzeltildi.

- **S4-7 (#72 / PR #113) — Feedback döngüsü**: `RecommendationFeedback.placeTypes` + yeni `FeedbackPreference` tablosu. Haftalık cron (`feedbackAggregator`, Pzt 05:00 UTC) saf `aggregateTypePreferences` ile beğenilen/beğenilmeyen mutfak tiplerini özetler; `buildUserProfileSummary` bunu `cuisinePreferences` olarak prompt'a + sistem prompt'una madde 9 olarak enjekte eder. Mobil feedback zinciri `placeTypes` taşır.

### Sosyal Akış

- **S4-4 (#69 / PR #109) — ActivityEvent temeli**: `ActivityEvent` modeli (type REVIEW|FAVORITE|RESERVATION|RECOMMENDATION) + idempotent migration. `logService.logActivity` fire-and-forget. 4 entegrasyon noktası (yorum/favori/rezervasyon/öneri); upsert'lerde yalnızca yeni kayıtta event.

- **S4-5 (#70 / PR #111) — Feed endpoint**: `GET /api/social/feed` — arkadaşların son 7 günü, **N+1'siz** (arkadaş id 1 query → event tek `findMany` → profil 1 query + Map), cursor tabanlı sayfalama. `(user_id, created_at)` indexi.

- **S4-6 (#71 / PR #112) — Feed ekranı**: `ActivityFeedScreen` + `activityFeedStore` (loadInitial/refresh/loadMore/clear). FriendsScreen'e "📰 Arkadaş Aktiviteleri" giriş banner'ı.

- **S4-8 (#73) — Docs + memory + retro**: Bu dosya + CLAUDE.md + memory güncellemeleri.

---

## Sayılar

| Metrik | Sprint-3 sonu | Sprint-4 sonu | Δ |
|---|---|---|---|
| Mobile test (geçen) | 111* | **139** | dokümante artış |
| Backend test (geçen) | 497* | **563** | dokümante artış |
| Yeni endpoint | — | `GET /api/social/feed` (+ stream endpoint'ine refinement) | +1 |
| Yeni DB modeli | — | ActivityEvent, FeedbackPreference | +2 |
| Yeni ekran | — | ActivityFeedScreen | +1 |
| Yeni servis/cron | — | recommendationSession, feedbackAggregator | +2 |

\* Sprint-3 sonrası PR #65 (kapsamlı E2E suite) tabanı büyüttü; doğrudan Δ kıyası yanıltıcı.

---

## İyi giden şeyler

### 1. Issue premise'ini koda karşı doğrulamak (S4-1)
"N+1 var" denmişti ama kod zaten batch'liydi. "Düzeltmeden" önce doğrulandı; gereksiz iş yapılmadı, asıl boşluk (cache) dolduruldu. **Ders:** issue açıklamaları bayatlayabilir, koda bak.

### 2. Streaming'e geçiş gizli kırık testleri açığa çıkardı (S4-3)
Refinement için ekranı streaming'e geçirince, store'daki 6 stream testinin `_mood` imzasıyla HEAD'de zaten kırık olduğu görüldü (mood-kaldırma refactor'undan kalma). Aynı dosyada çalışırken düzeltildi → suite artık güvenilir.

### 3. Feed baştan N+1'siz tasarlandı (S4-5)
Arkadaş id + tek event sorgusu + profil Map'i ile feed, büyüyen sosyal grafikte sabit sorgu sayısı. S4-1'in cache mantığıyla tutarlı performans disiplini.

### 4. Pre-existing test borcu sessizce gömülmedi
`passesQualityFilter` mock eksikliği + stale mood testi her PR'da "bağımsız" olarak not düşüldü ve bakım issue'su **#110** açıldı (Sprint-8). Feature PR'ları temiz kaldı.

### 5. Kullanıcının commit'siz rebrand WIP'i şeffaf yönetildi
Mobil dosyalardaki (RecommendationScreen, social.ts, navigation, RecommendationCard) commit'lenmemiş rebrand değişiklikleri tespit edilince bir kez soruldu, sonra aynı karar tutarlı uygulandı ve her commit/PR'da not düşüldü.

---

## Zorlandığımız yerler

### 1. Commit'siz mobil WIP ile feature kodu iç içe
Pre-existing rebrand değişiklikleri benim feature hunk'larımla aynı dosyalarda olduğu için ayrıştırılamadı; kullanıcı kararıyla birlikte commit'lendi ama feature PR'larını "kirletti". Ayrı bir rebrand branch'i akışı netleştirirdi.

### 2. Canlı UI doğrulanamadı
RN/Expo emülatörü bu ortamda yok. S4-3 (refinement chip'leri) ve S4-6 (feed ekranı) yalnızca tip + store testleriyle doğrulandı; gerçek SSE akışı, chip etkileşimi, pull-to-refresh/sonsuz scroll cihazda **manuel test bekliyor**.

### 3. Feedback "mutfak tipi" için veri kaynağı yoktu (S4-7)
`RecommendationFeedback` sadece placeId+sentiment tutuyordu. "Mutfak tiplerini aggregate et" için feedback'e `placeTypes` eklemek gerekti (backend+mobil). Geriye dönük feedback'ler tipsiz → aggregate yalnızca yeni feedback ile dolacak.

### 4. Pre-existing backend test hataları birikti
5 suite kırık (candidateService, promptBuilder/belirtilmedi, recommendations, recommendations-perf, api.test.js) — tümü aynı `passesQualityFilter` mock ailesi + mood. #110'da toplandı; bir an önce kapatılmalı, aksi halde gerçek regresyonları maskeler.

---

## Sürprizler / Keşifler

### 1. "Şu an nereye" altyapısı zaten vardı
Sprint planlaması sırasında, 2.2 özelliğinin dayandığı `MealGroup` + `Poll` modellerinin schema'da MEVCUT olduğu doğrulandı — efor tahmini düştü (Sprint-7'ye taşındı).

### 2. RecommendationScreen yorum-kod çelişkisi
Ekranın header yorumu "streaming kullanıyor" diyordu ama kod streaming-olmayan `fetchDinnerRecommendation`'ı çağırıyordu. Yorumlar rot edebilir; S4-3 bunu gerçek streaming'e geçirerek hizaladı.

### 3. node-cron + saf fonksiyon ayrımı testi kolaylaştırdı
`aggregateTypePreferences` saf fonksiyon olarak ayrıldığı için DB/cron olmadan 8 birim testiyle kapsandı.

---

## Sprint-5 hazırlığı / backlog

1. **#110 — kırık test-mock'ları** ([yüksek öncelik]) — Sprint-8'e konuldu ama bağımsız; Sprint-5 başında çekilmesi CI güvenini geri getirir.
2. **Canlı UI doğrulaması** — S4-3 + S4-6 ekranlarını cihazda manuel test et (APK build).
3. **Rebrand WIP'i ayrı branch'e** — commit'siz mobil rebrand değişikliklerini bağımsız bir branch/PR'a topla.
4. Sprint-5 (Restoran B2B) planı hazır: rezervasyon otomatik son süre, level-up bildirimi, anlık kampanya, restoran analitik paneli.

---

## Workflow değerlendirmesi

Sprint-4 de **atomik task → branch → PR → merge** döngüsüne sadık kaldı. 8 task, 7 feature PR, user "merge ettim, devam et" ile ilerledi. Backend→mobile bağımlılığı (S4-2→S4-3, S4-5→S4-6) sıralı çalışmayı zorunlu kıldı; sprint planındaki bağımlılık okları bunu önceden gösteriyordu.

---

**Retro yazarı:** Claude (Opus 4.7)
**Son güncellenme:** 2026-05-29
