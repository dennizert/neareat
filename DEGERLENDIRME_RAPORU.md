# Eatlas (NearEat) — Teknoloji, Kalite ve Adaptasyon Değerlendirme Raporu

**Tarih:** 2026-06-15
**Kapsam:** `neareat-backend` + `neareat-mobile` monorepo
**Yöntem:** Kod tabanı yerinde incelendi (bağımlılık sürümleri, dosya organizasyonu, test düzeni, CI yapılandırması). Rapor CLAUDE.md beyanlarına değil, gerçek koda dayanır.

---

## Özet Tablo (Hızlı Bakış)

| Boyut | Durum | Not |
|---|---|---|
| Teknoloji güncelliği | 🟢 İyi | Backend güncel, mobil 1 major geride |
| Kod kalitesi / organizasyon | 🟢 İyi | Katmanlı, saf-çekirdek + test deseni |
| Test kapsamı | 🟢 Güçlü | 77 backend + 37 mobil test dosyası, CI kapısı |
| Güvenlik | 🟢 İyi | Çok katmanlı; birkaç operasyonel risk |
| Bakım / modifiye edilebilirlik | 🟡 İyi ama yük artıyor | Domain ayrımı net; bazı dosyalar şişiyor |
| Esneklik | 🟡 Orta-İyi | Env-tunable ama tek dağıtım hedefine bağlı |

**Ölçek özeti:** Backend ~14.190 satır JS (23 controller / 21 servis / 23 route, 38 Prisma modeli, 33 migration); Mobil ~30.800 satır TS/TSX (23 ekran, 12 Zustand store); 77 backend + 37 mobil test dosyası; CI'da test + güvenlik audit kapısı.

---

## 1. Teknoloji Kullanımı ve Güncelliği

### Backend (Node.js)

Ölçek: **~14.190 satır**, 23 controller / 21 servis / 23 route, **38 Prisma modeli**, 33 migration.

| Paket | Sürüm | Değerlendirme |
|---|---|---|
| Express | `5.2.1` | 🟢 En güncel major (Express 5). Çoğu proje hâlâ 4'te — burada öncü. |
| Prisma | `6.19` | 🟢 Güncel major. `directUrl`/PgBouncer ayrımı doğru kurulmuş. |
| @anthropic-ai/sdk | `0.97` | 🟢 Güncel; SSE streaming + maliyet ölçümü doğru kullanılmış. |
| @sentry/node | `8.x` | 🟢 Güncel. |
| ioredis, helmet, zod, bcryptjs, node-cron | güncel | 🟢 Standart, sağlam seçimler. |
| Node engine | `>=18`, CI `20` | 🟢 LTS uyumlu. |

**Değerlendirme:** Backend bağımlılık seti **güncel ve bilinçli seçilmiş**. Express 5'e geçilmiş olması (ki çoğu ekip riskli bulup ertelemektedir) teknik özgüven göstergesi. zod 4 / zustand 5 gibi yeni major'lara henüz geçilmemiş ama bunlar opsiyonel.

### Mobil (React Native / Expo)

Ölçek: **~30.800 satır TS/TSX**, 23 ekran, 12 Zustand store, **strict TypeScript açık**.

| Paket | Sürüm | Değerlendirme |
|---|---|---|
| Expo SDK | `~52` | 🟡 1–2 major geride (güncel hat 53/54). Sürdürülebilir ama planlanmalı. |
| React Native | `0.76.3` | 🟡 Expo 52'ye bağlı; React 18.3 (React 19 değil). |
| Zustand | `4.5` | 🟢 Sağlam; v5 opsiyonel. |
| TypeScript | `5.3`, `strict: true` | 🟢 Strict mode + paylaşılan tip katmanı (`src/types`) iyi disiplin. |
| Sentry RN, reanimated, maps | güncel hat | 🟢 |

**Değerlendirme:** Mobil tarafın tek somut güncellik borcu **Expo 52 → 53/54** yükseltmesi. Expo yükseltmeleri kümülatif olarak zorlaşır; 6-12 ayda bir planlanmazsa ileride büyük bir "big-bang" yükseltmeye dönüşür.

### Genel Teknoloji Yargısı

🟢 **Modern, tutarlı, tek dil ailesi (JS/TS) ile baştan sona tek yığın.** Yeni nesil yetenekler (LLM streaming, IAP, push, gerçek zamanlı maliyet ölçümü) doğru kütüphanelerle entegre. En büyük güncellik riski mobil Expo sürüm borcu.

---

## 2. Yapısal Avantaj ve Dezavantajlar

### 2.1 Esneklik (Flexibility)

**Avantajlar**
- **Env-tunable mimari:** Maliyet tavanları, cache TTL'leri, tile hassasiyeti, rate-limit'ler, replica davranışı hep environment değişkeniyle ayarlanıyor (`PREMIUM_AI_DAILY_CAP`, `NEARBY_TILE_DECIMALS`, `FRIEND_JOB_CHUNK` vb.). Kod değiştirmeden davranış ayarı = operasyonel esneklik.
- **Saf çekirdek (pure-core) deseni:** İş mantığı `utils/` ve `services/` içinde yan etkisiz fonksiyonlara çıkarılmış (`personalizationService`, `mapClustering`, `restaurantAnalytics`). Bu hem test hem de yeniden kullanımı kolaylaştırır.
- **Sağlayıcı-agnostik soyutlamalar:** Analytics sink, Sentry, e-posta servisi hep "yoksa no-op" deseniyle takılıp çıkarılabilir.
- **Çift kimlik doğrulama stratejisi** (JWT + Firebase) tek JWT'ye indirgenmiş — ileride üçüncü sağlayıcı eklemek kolay.

**Dezavantajlar**
- **Tek dağıtım hedefine bağımlılık:** Railway'e özgü ayarlar (keep-alive timeout'ları, `railway.toml`, proxy 502 önlemleri) koda gömülü. Başka platforma taşımak ekstra iş gerektirir.
- **Restaurant DB'de tutulmuyor** (sadece Google `placeId`). Bu maliyet/lisans açısından mantıklı ama Google Places'e **sağlayıcı kilidi** yaratır; başka harita sağlayıcısına geçiş büyük refactor olur.

### 2.2 Güvenlik (Security)

**Avantajlar (güçlü taraf)**
- **Çok katmanlı istek hattı:** helmet → CORS → rate-limit (auth/user/AI ayrı) → sanitize → auth → roles. Olgun bir API gateway dizilimi.
- **Fail-closed maliyet/abuse frenleri:** Redis düştüğünde AI rate-limit düşük bir bellek-içi tavana iner (fail-open değil) — para/abuse riskine karşı doğru tercih.
- **Sır yönetimi:** Token'lar DB'de HMAC-hash'li (`tokenHash.js`), purchase token'lar hash'li ledger'da, e-posta enumeration sızıntısı engellenmiş, per-adres throttle.
- **CI güvenlik kapısı:** `audit.yml` her PR'da yüksek/kritik açıkta build'i kırıyor. `test.yml` test kapısı.
- Geçmiş pentest bulguları (Sprint-12) kapatılmış; IAP client-trust, RTDN auth, admin brute-force ele alınmış.

**Dezavantajlar / Dikkat noktaları**
- **Metrics ve AI fallback per-replica:** Yatay ölçeklemede metrik/limit tutarlılığı replika başına; bu bilinçli ama izlenmesi gereken bir taviz.
- **Operasyonel sır bağımlılığı:** Birçok kritik koruma (`ENFORCE_EMAIL_VERIFICATION`, alarm eşikleri, `ADMIN_SEED_SECRET`) **doğru env ayarına bağlı** — kod sağlam ama yanlış üretim konfigürasyonu sessizce korumayı zayıflatabilir.
- **Redis tek nokta hassasiyeti:** Cron leader-lock ve cache Redis'e bağlı; Redis HA'sı dış kalmış (önceki bir oturumda Redis restart'ın auth'u düşürdüğü incident yaşanmış).

### 2.3 Bakım (Maintainability)

**Avantajlar**
- **Net domain ayrımı:** controller / route / service / job / util katmanları tutarlı; "bir domain = bir dosya" kuralı.
- **Güçlü test ağı:** 77 backend + 37 mobil test dosyası, mock'lanmış dış servisler, pure-core birim testleri. Regresyon güvenliği yüksek.
- **Mükemmel kurumsal hafıza:** `CLAUDE.md` + memory dosyaları her sprint kararını, sebep-sonuç ilişkisiyle kaydediyor. Bu, çoğu projede olmayan bir bakım avantajı.
- **Migration disiplini:** commit'li, otomatik uygulanan, "uygulandıktan sonra düzenleme yok" kuralı.

**Dezavantajlar**
- **Dosya şişmesi riski:** 38 model tek `schema.prisma`'da (909 satır); bazı controller'lar (recommendation, restaurant) çok sorumluluk taşıyor. Henüz yönetilebilir ama büyüme eğrisinde izlenmeli.
- **Sprint-kodlu jargon:** "S16-3", "S14-B5" gibi etiketler yorumlara gömülü — ekip için kısayol ama yeni gelen için ilk bakışta opak (bu rapordaki yol haritası bunu telafi ediyor).
- **CLAUDE.md ağırlığı:** Dokümantasyon çok zengin ama tek dosyada; kodla eşzamanlı güncel tutma yükü ekibe bağlı.

### 2.4 Modifiye Edilebilirlik (Modifiability)

**Avantajlar**
- Yeni özellik eklemek için **net bir reçete var:** model → migration → service (saf çekirdek) → controller → route → test; mobilde service → store → screen. Tutarlılık tahmin edilebilirlik sağlar.
- Saf fonksiyonlar + env-tunable parametreler sayesinde davranış değişiklikleri çoğunlukla **lokal**.
- TypeScript strict + paylaşılan tipler, mobilde değişikliklerin kırılmalarını derleme anında yakalıyor.

**Dezavantajlar**
- **İki paket arası sözleşme örtük:** Backend yanıt şekli ile mobil tip katmanı manuel senkronize ediliyor (paylaşılan/üretilen tip yok). Bir endpoint değişince iki tarafı elle hizalamak gerekiyor.
- **Replika-güvenli olmayan yeni kod yazma riski:** Cron eklerken `withCronLock` sarmalı unutulursa çift çalışır — kural var ama makine zorlamıyor.

---

## 3. Bir Yazılımcının Sisteme Adaptasyonu — Seviye Seviye Yol Haritası

> Hedef: Sıfırdan başlayan bir geliştiriciyi, üretim seviyesinde katkı verebilir hale getirmek. Her seviye bir öncekinin üzerine inşa edilir.

### Seviye 0 — Ortam & İlk Çalıştırma (½–1 gün)

**Amaç:** Projeyi lokalde ayağa kaldırmak.
1. `CLAUDE.md`'yi baştan sona oku (mimari + komutlar + konvansiyonlar).
2. PostgreSQL 17 + Redis kur.
3. Backend: `cd neareat-backend && npm ci`, `.env` doldur, `npm run prisma:migrate`, `npm run dev` → `/health` 200 mi?
4. Mobil: `cd neareat-mobile && npm ci`, `src/config.ts` içinde `API_URL`'i lokale çevir, `npm start`.
5. `Pixel_7_Standard` emülatörünü kullan (Pixel_7 değil — 16KB sayfa sorunu).

**Çıktı:** Lokal backend + emülatörde giriş yapabiliyor olmak.

### Seviye 1 — Kod Haritası & Okuma (1–2 gün)

**Amaç:** Bir isteğin uçtan uca yolunu görmek.
1. Tek bir özelliği dikey kes: örn. **favori ekleme**. Mobil `RestaurantDetailScreen` → `services/favorites.ts` → `store/favoriteStore`; backend `routes` → `controllers` → `services`/Prisma.
2. Backend istek hattını oku: `middleware/` (auth, roles, sanitize, rate-limit).
3. `prisma/schema.prisma` ile ana ilişkileri (User ↔ Review/Favorite/Reservation) çıkar.
4. **Test çalıştır:** `npm test` (backend) ve mobilde `npm test` — yeşil tabanı gör.

**Çıktı:** "Bir özellik hangi katmanlardan geçer?" sorusunu çizebilmek.

### Seviye 2 — İlk Küçük Katkı (2–4 gün)

**Amaç:** Konvansiyonlara uyarak küçük bir değişiklik + test + PR.
1. Workflow'u öğren: task başına branch + PR, gated akış.
2. Issue formatına uy (7 başlıklı zorunlu şablon: Amaç/Kapsam/Gereksinimler/UseCases/Senaryolar/TestCases/KabulKriterleri).
3. Küçük bir saf-mantık (`utils/`) iyileştirmesi yap + birim testi ekle. **Pure-core + test** desenini taklit et.
4. Tüm metin **Türkçe** (UI/hata/yorum); commit ve kod tanımlayıcıları **İngilizce**.
5. `tsc --noEmit` temiz, CI (test + audit) yeşil olsun.

**Çıktı:** Birleşmiş ilk PR.

### Seviye 3 — Tam Dikey Özellik (1–2 hafta)

**Amaç:** Bir özelliği uçtan uca eklemek.
1. Backend reçetesi: **model → migration → service (saf çekirdek) → controller → route → validasyon (zod `validate` middleware) → test.**
2. Mobil reçetesi: **service (tipli) → store (Zustand) → screen → ortak UI bileşenleri (`AppIcon`/`Toast`/`Skeleton`/`PressableScale`) → utils testi.**
3. Premium/free tier kapısını doğru uygula (403 `PREMIUM_REQUIRED` → Paywall).
4. Migration disiplinine uy: commit'li, uygulandıktan sonra düzenleme yok.

**Çıktı:** Üretime gidebilecek dikey bir özellik + testler.

### Seviye 4 — Çapraz Kesen Konular (2–4 hafta)

**Amaç:** Sistemik konularda güvenle çalışmak.
1. **AI hattı:** `recommendationService` (SSE streaming), session refinement, maliyet tavanı + kısa-TTL cache. Anthropic SDK kullanımını öğren.
2. **Maliyet & metrik:** `recordExternalCall`, `services/metrics.js`, alarm eşikleri. Her dış çağrı maliyet ölçer.
3. **Cron & replika güvenliği:** Yeni cron'u **mutlaka** `withCronLock` ile sar; saf karar mantığını dışa aç + birim test et.
4. **Caching:** Redis anahtar şemaları (nearby tile, rec-cache, social-signals), TTL'ler.

**Çıktı:** Maliyet ve ölçeklenme bilinci olan, sistemik değişiklik yapabilen geliştirici.

### Seviye 5 — Operasyon & Sahiplik (sürekli)

**Amaç:** Üretimi yönetebilmek.
1. **Deploy:** `git push origin master` → Railway otomatik. `railway.toml`, rolling deploy, `/health` drain davranışı.
2. **Ölçeklenme:** `docs/HORIZONTAL_SCALING.md`, `docs/DB_POOL_PGBOUNCER.md`, k6 yük testleri (staging-only guard).
3. **Sürüm:** Android AAB/APK build (`JAVA_HOME` = Android Studio JBR), versionCode artırımı.
4. **İzleme:** Sentry, `GET /api/admin/metrics`, alarm breach'leri.
5. **Üretim env aksiyonları:** Env'e bağlı korumaların açık olduğunu doğrula.

**Çıktı:** Bir özelliği fikirden üretim izlemesine kadar sahiplenebilen geliştirici.

---

## 4. Öncelikli Öneriler (Aksiyon)

1. 🟡 **Expo 52 → 53/54 yükseltmesini planla.** Geciktikçe maliyeti üstel artar.
2. 🟡 **Backend↔mobil tip sözleşmesini otomatikleştir** (paylaşılan tip paketi / OpenAPI üretimi). Manuel senkron en kırılgan nokta.
3. 🟢 **`schema.prisma`'yı domain bazlı böl** (Prisma `prismaSchemaFolder`) — 909 satır büyümeye devam edecek.
4. 🟢 **Redis HA'yı sağlamlaştır** (önceki incident; cron-lock + cache buna bağlı).
5. 🟢 **Üretim env checklist'ini repoya kalıcı bir doküman yap** — kod sağlam ama korumalar konfigürasyona bağlı.

---

## Genel Kanı

Tek geliştirici/küçük ekip ürünü için **olgunluğun çok üzerinde**; katmanlı mimari, güçlü test ağı, maliyet bilinci ve istisnai kurumsal hafıza ile öne çıkıyor. Başlıca borçlar **operasyonel** (mobil sürüm güncelliği, env'e bağlı güvenlik, iki-paket tip senkronu) — mimari değil. Sağlam bir temel.
