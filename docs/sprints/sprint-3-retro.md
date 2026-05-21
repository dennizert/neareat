# Sprint-3 Retrospektifi — Recommender v2.0: Streaming + Route

**Sprint adı:** Sprint-3: Recommender v2.0 — Streaming + Route  
**Başlangıç:** 2026-05-21 (Task #1)  
**Bitiş:** 2026-05-21 (Task #10)  
**Milestone:** Sprint-3: Recommender v2.0  
**Task'lar:** 10 GitHub issue (#45-#54), her biri ayrı PR ile (PR #52-#64)

---

## Hedef

Sprint-2'de production'a alınan AI öneri motorunu ikinci nesle taşımak:
- **Streaming** (TTFB < 1sn, kartlar birer birer Progressive Reveal ile görünür)
- **Feedback → LLM signal** (kullanıcının geçmiş 30 gün beğeni/beğenmeme geçmişi prompt'a eklenir)
- **Circuit breaker** (photo enrichment paralel istekleri max 2 eşzamanlı)
- **Rota önerisi** ("Yolda ne yesem?" — A→B rotasında durak önerisi)

---

## Sonuç: ✅ TAMAMLANDI

10 task'ın 10'u merge edildi. 497 backend + 111 mobile test, tümü geçiyor.

---

## Ne yapıldı?

### Backend — Veri Kalitesi

- **Task #1 (#45) — Feedback → LLM signal**: `buildFeedbackHistory(userId)` — son 30 gün, max 20 kayıt, `id ASC` sıralı (cache key stabilitesi). Pozitif/negatif ayrımı. System prompt'a "Geçmiş Beğeniler" bölümü eklendi. `buildUserProfileSummary`'nin 7. Promise.all entry'si.

- **Task #2 (#46) — Circuit breaker**: `candidateService.js`'te `PHOTO_ENRICH_CONCURRENCY = 2`. Manual batching: `for` döngüsü + `Promise.allSettled` 2'li chunk'lar. Harici paket yok — `p-limit` eklenmedi.

### Backend — Streaming

- **Task #3 (#47) — SSE streaming endpoint**: `recommendationService.js`'te `recommendStream()` — Anthropic `client.messages.stream()`. 4 SSE event tipi: `card`, `note`, `done`, `error`. `req.on('close', stream.abort)`. `POST /api/recommendations/dinner-tonight/stream`. `/dinner-tonight` (non-streaming) korundu.

### Backend — Rota Önerisi

- **Task #6 (#50) — Rota önerisi backend**: `googlePlaces.js`'te `getRouteWaypoints(originLat, originLng, destLat, destLng)` — Google Directions API, 1h Redis cache, max 3 ara nokta. `recommendationService.js`'te `recommendForRoute()` — çoklu waypoint aday birleştirme + dedupe + `waypointIndex` → `sequenceOrder`. `POST /api/recommendations/route-tonight`. Free/premium ortak günlük sayaç.

### Mobile — Streaming UI

- **Task #4 (#48) — Mobile SSE client**: `aiRecommendation.ts`'te `streamDinnerRecommendation()` — React Native 0.76/Hermes `fetch` + `response.body.getReader()`. SSE chunk parser (newline split, `data:` prefix). 4 callback: `onCard`, `onNote`, `onDone`, `onError`.

- **Task #5 (#49) — Progressive UI**: `RecommendationScreen.tsx` güncellendi. `streamDinnerRecommendation` ile değiştirildi. `FadeInCard` (`Animated.FadeIn`) ile her kart birer birer görünür. `streamingStatus === 'streaming'` → "Durdur" butonu. `cancelStream()` `AbortController.abort()` ile SSE'yi keser.

### Mobile — Rota Önerisi

- **Task #7 (#51) — Rota mobile types/service/store**: `types/index.ts`'e `RouteRestaurant`, `RouteRecommendation`, `RouteRecommendationRequest`, `RouteRecommendationResponse`. `aiRecommendation.ts`'e `getRouteRecommendation()`. Store'a route slice: `routeRecommendations`, `routeMeta`, `fetchRouteRecommendation`, `resetRoute`.

- **Task #8 (#52) — RouteRecommendationScreen**: Yeni ekran — 3 preset hedef (Kadıköy, Havalimanı, Şişli) + mood picker + "N. Durak" etiketli sıralı liste + rota özet satırı (~X km · ~Y dk). `navigation/index.tsx`'e stack screen. `HomeScreen`'e "🗺️ Yolda ne yesem?" ikinci CTA banner.

### Kalite & Düzeltmeler

- **Task #9 (#53) — Test coverage**: 14 yeni backend integration testi (`/route-tonight` auth/validation/happy-path/rate-limit), 8 yeni mobile store testi (fetchRouteRecommendation/resetRoute). **Kritik bug fix**: `buildVariableBlock`'ta `const text` → `let text` (Sprint-3 Task #1'in eklediği `text +=` satırı runtime `TypeError` atıyordu; HTTP 500 olarak görünüyordu).

- **Task #10 (#54) — Docs + retro**: Bu dosya.

---

## Sayılar

| Metrik | Sprint-2 sonu | Sprint-3 sonu | Δ |
|---|---|---|---|
| Backend test sayısı | **475** | **497** | **+22** |
| Mobile test sayısı | **103** | **111** | **+8** |
| Backend endpoint sayısı | ~52 | ~54 | +2 (/stream, /route-tonight) |
| Yeni ekran | — | RouteRecommendationScreen | +1 |
| Yeni type | — | RouteRestaurant, RouteRecommendation*, StreamingStatus | +5 |

---

## İyi giden şeyler

### 1. React Native SSE için ekstra paket gerekmedi

RN 0.76 / Hermes `fetch` + `response.body.getReader()` destekliyor. `EventSource` polyfill, `react-native-sse` paketi gibi bağımlılıklar eklenmedi. Native stream API ile temiz bir SSE client yazıldı.

### 2. `const` → `let` bug'ı test sayesinde bulundu

Sprint-3 Task #1'de `buildVariableBlock`'a `text +=` eklenirken `const` olduğu gözden kaçtı. Bug Task #9'daki integration testlerin HTTP 500 vermesiyle ortaya çıktı — manuel test olmadan production'a geçseydi `/route-tonight` hiç çalışmayacaktı. Testlerin değeri somutlaştı.

### 3. Rota ekranı için preset hedef tasarımı süreci hızlandırdı

"Hedef adres gir → Google Geocoding → koordinat" akışı fazladan 2 servis katmanı demekti. 3 preset buton (Kadıköy/Havalimanı/Şişli) ile gerçek bir test edilebilir flow kuruldu. Scope creep önlendi.

### 4. Ortak rate limit sayacı mimari karar olarak netleşti

`/dinner-tonight` ve `/route-tonight` aynı `AiRecommendationLog` tablosuna yazıyor — free tier günlük 3 hak her iki endpoint'i kapsıyor. Ayrı sayaçla gidilseydi kullanıcı "6 istek"e çıkabilirdi; bu doğru değildi.

### 5. `RecommendationCard` tekrar kullanımı — cast pattern işe yaradı

`RouteRecommendationScreen`'de `rec as unknown as AiRecommendation` cast'i ile ayrı kart bileşeni yazmadan mevcut `RecommendationCard` kullanıldı. `RouteRestaurant extends AiRecommendationRestaurant` yapısal uyumluluk sayesinde runtime'da sorun çıkmadı.

---

## Zorlandığımız yerler

### 1. SSE chunk parse'ı — newline boundary sorunları

HTTP streaming'de chunk sınırları `data:` event sınırlarıyla örtüşmüyor. Tek bir `onText` callback'i yarım JSON alabiliyor. `bufferChunks` + `\n\n` splitter pattern ile çözüldü — SSE spec'e uygun.

### 2. `buildVariableBlock` `const` bug — sessiz hata

`promptBuilder.js`'te `const text = ...` ifadesi görsel olarak masum görünüyordu. TypeScript değil JavaScript olduğu için compile-time hata yok. Yalnızca çalışma zamanında (route endpoint'inde routeContext varken) ortaya çıktı. Bu tür mutation hatalarını erken yakalamak için servise TypeScript geçiş düşünülebilir.

### 3. Rota test mock kurulumu — `getRouteWaypoints` eklentisi

`recommendations.test.js`'te global `mockGooglePlaces` objesine `getRouteWaypoints: jest.fn()` eklenmesi gerekti. `beforeEach`'te default resolved value de kuruldu. Yeni servis fonksiyonu eklendikçe test mock'unun da güncellenmesi gereken bir pattern — kırılgan.

---

## Sürprizler / Keşifler

### 1. Streaming endpoint ön-koşul kontrolü critical path'te

SSE başlamadan önce rate limit ve auth kontrolü yapılmazsa stream yarıda kesilemez (header zaten gönderilmiş olur). `getDinnerTonightStream` handler'ında `recommendStream()` çağrısı öncesinde tüm validation'lar senkron çalıştırılıyor — bu sıranın önemi task sırasında net göründü.

### 2. Directions API → waypoint mantığı düşündüğümüzden basit çıktı

Başlangıçta polyline decode + segment midpoint hesaplama karmaşık görünüyordu. Ama Google Directions API `legs[*].end_location` ile kullanılabilir noktaları zaten veriyor. Max 3 ara nokta için `legs` dilimlemesi yeterliydi.

### 3. Mobile store route slice büyüdü — tasarım baskısı

`aiRecommendationStore.ts` Sprint-3'te route state ile birlikte 340 satıra çıktı. Henüz kritik değil ama Sprint-4'te `routeRecommendationStore.ts` ayrıştırması makul olabilir.

---

## Sprint-4 backlog önerileri (öncelik sırası)

1. **Streaming + route birleşimi** ([orta]) — `/route-tonight/stream` SSE streaming versiyonu
2. **Yer arama (Geocoding) → preset alternatifi** ([orta]) — Google Places Autocomplete ile hedef seçimi; şu an sadece preset var
3. **Grup önerisi** ([orta]) — 3+ arkadaş kesişimi; v3 hedefi; Sprint-2'den ertelendi
4. **`buildVariableBlock` TypeScript'e geçiş** ([düşük teknik borç]) — JS → TS ile mutation bug'larını derleme zamanında yakala
5. **Route store ayrıştırması** ([düşük teknik borç]) — `routeRecommendationStore.ts` ayrı dosya
6. **Component render tests** ([düşük teknik borç]) — Detox / react-test-renderer ile ekran testleri

---

## Workflow değerlendirmesi

Sprint-3 de **atomik task → branch → PR → merge** döngüsüne sadık kaldı. 10 task, 10 PR, user "merge ettim" komutu ile ilerledi.

**Gözlem:** Sprint-3, Sprint-2'ye kıyasla backend + mobile paralel iş içeriyordu (Task #3+#4 SSE, Task #6+#7+#8 Route). Sıralı çalışma zorunluydu (backend bitmeden mobile yazılamaz) — bu 10 task'ı aynı gün tamamlamayı sınırladı. Sprint planında bağımlılık okları daha belirgin tutulabilir.

---

**Retro yazarı:** Claude (Sonnet 4.6)  
**Son güncellenme:** 2026-05-21
