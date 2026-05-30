# Sprint-7 Retrospektifi — Kullanıcı Deneyimi & Sosyal Derinleşme

**Tarih:** 2026-05-30  
**Süre:** 1 gün (yoğun sprint)  
**Backend Test:** 840 / 44 suite  
**Mobile Test:** 159 / 9 suite  
**PR'lar:** #144 – #152 (9 PR)

---

## Tamamlanan Görevler

| # | Task | PR | Açıklama |
|---|------|----|----------|
| S7-2 | CheckIn Backend | #144 | `CheckIn` modeli, lazy expiry (3h TTL), `CHECKIN` ActivityEvent, 8 test |
| S7-3 | CheckIn Mobile UI | #145 | RestaurantDetailScreen check-in akışı, aktif check-in gösterimi |
| S7-4 | Yemek Günlüğü | #146 | `DiaryEntry` modeli, `DiaryScreen` (stats + liste), `computeDiaryStats` pure fn |
| S7-5 | Vision Endpoint | #147 | `POST /api/recommendations/analyze-photo`, claude-haiku-4-5 multimodal, free-tier Redis sayacı (3/gün) |
| S7-6 | Fotoğraf Analizi UI | #148 | PhotoGallery "🤖 Bu nasıl?" overlay, bottom-sheet modal, spinner + sonuç |
| S7-7 | "Şu an nereye?" | #149 | `POST /api/meal-groups/:id/quick-poll` konum bazlı anket, MealGroupDetailScreen iki buton akışı |
| S7-8 | Referral Kodu | #150 | Lazy kod üretimi, tek seferlik uygulama, referrer 15⭐ + referred 10⭐, ReferralScreen + ProfileScreen girişi |
| S7-10 | Cuisine Chip Filtresi | #151 | HomeScreen chip satırı, client-side filtreleme, AsyncStorage persist |
| S7-11 | Cuisine Card Badge | #152 | RestaurantCard'da max 2 tag pill |

**Ayrıca:** #140 muhallebi/pizzeria cuisineTag bug fix (E2E testinde yakalandı)

---

## Test Artışı

| Alan | Sprint Başı | Sprint Sonu | Artış |
|------|-------------|-------------|-------|
| Backend | 823 | 840 | +17 |
| Mobile | 159 | 159 | +0 (yeni unit gerekmedi) |
| Backend suite | 42 | 44 | +2 |

---

## İyi Gidenler

- **Lazy expiry pattern** (CheckIn): cron yerine `expiresAt > now` filtresi — basit ve etkili
- **Photo analysis rate limiting**: sayaç LLM çağrısından önce increment → race condition yok
- **Quick poll**: tek tıkla konum → yakın restoranlar → anket — backendde 8 test, mobildo tek handler
- **Referral mock zinciri**: `mockResolvedValueOnce` sırası ilk denemede karıştı; global + describe `beforeEach` katmanlaması yerine inline mock ile çözüldü
- **Cuisine chips**: `useMemo` ile yüklü listeden unique tag çıkarımı — API çağrısı yok, anlık

## Zorlandığımız Noktalar

- **Branch kalabalığı**: context compaction sonrası hangi PR açık olduğunu takip etmek dikkat istedi
- **`logService` mock eksikliği**: bazı yeni testlerde `prisma.userLog.create` mock'lanmamış, `console.error` logu çıktı ama test geçti — kritik değil ama gürültülü
- **`expo-location` tip uyumu**: `Location.Accuracy.Balanced` TypeScript'te doğrudan kullanılabildi, sorun olmadı

---

## Sprint-8 Backlog (Planlanan)

Feature-Plan.md'de C/D/E/F/G grubu olarak kaydedildi:

| Başlık | Öncelik |
|--------|---------|
| Keşfet harita cluster'ı | Yüksek |
| Push notification deep link yönetimi | Yüksek |
| Restoran "Bugün Ne Var?" (özel menü) | Orta |
| Sosyal aktivite feed pagination | Orta |
| Admin: toplu kullanıcı export (CSV) | Düşük |
