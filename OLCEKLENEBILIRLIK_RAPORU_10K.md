# Ölçeklenebilirlik Raporu — 10.000 Aktif Kullanıcı Hedefi

**Tarih:** 2026-06-13
**Kapsam:** NearEat/Eatlas backend (Node/Express + Prisma + PostgreSQL + Redis, Railway) + mobil istemci
**Soru:** Mevcut veritabanı / sunucu / altyapı 10.000 aktif kullanıcıyı kaldırır mı? Kaldırmıyorsa ne yapmalı?

---

## 0. Yönetici Özeti

**Kısa cevap:** Mevcut mimari **birkaç bin kullanıcıya kadar idare eder**, ancak **10.000 aktif kullanıcı için olduğu gibi YETERLİ DEĞİL**. Teknik olarak çökme riski orta; asıl riskler **(a) tek sunucu = tek hata noktası (SPOF)**, **(b) yatay ölçeklemeyi bloke eden tasarım kararları** ve **(c) kontrolsüz dış-API (AI + Google) maliyeti**.

**Olgunluk skoru (10k hedefi için): 🟠 Orta — üretime çıkılabilir ama önce P0 işleri yapılmalı.**

| Katman | Durum | Risk |
|---|---|---|
| Uygulama sunucusu (Node) | Tek process, clustering yok | 🔴 Yüksek (SPOF + tek çekirdek) |
| Veritabanı (Postgres) | İndeksler iyi, havuz tuning yok, PgBouncer yok | 🟠 Orta |
| Redis (cache + rate limit) | Var ama fail-open/opsiyonel; ölçekte yük taşıyıcı olur | 🟠 Orta |
| Dış API maliyeti (Anthropic + Google) | Caching var ama tavan/izleme zayıf | 🔴 Yüksek (finansal) |
| Cron/arka plan işleri | In-process node-cron, 10k'da bellek sıçraması + replika çakışması | 🟠 Orta |
| Gözlemlenebilirlik | Sentry var; metrik/alarm (p95, hata, DB havuz, harcama) yok | 🟠 Orta |

---

## 1. Yük Tahmini (10.000 aktif kullanıcı)

Varsayımlar (tipik mobil keşif uygulaması):
- **DAU = 10.000**, oturum/gün ≈ 1,5, oturum başına ≈ 20–40 istek.
- Toplam ≈ **300.000–500.000 istek/gün**.
- Ortalama ≈ **4–6 istek/sn**; **tepe saat** (akşam yemeği 19:00–21:00) günün ~%15–20'si → **tepe ≈ 40–90 istek/sn**, kısa patlamalar 100+/sn.
- Eşzamanlı "anlık" istek (in-flight) tepe: ~30–80.

**Sonuç:** Ham istek/sn düşük; sorun *hacim* değil. Asıl yük şu "ağır" uçlarda yoğunlaşır:
- **`/restaurants/nearby`** — cache-miss'te 5 paralel Google çağrısı (~0,7–1 sn bağlantı tutar).
- **`/recommendations/*`** — Anthropic SSE streaming, istek başına **saniyeler** sürer ve bağlantı + maliyet tutar.
- **`/auth/login`** — bcrypt (CPU-bound, event-loop bloke eder).

---

## 2. Yapılan Testler ve Ölçümler

### 2.1 Kontrollü eşzamanlılık probu (production `/health`)
`/health` = `SELECT 1` + Redis `ping` (Google/AI maliyeti yok, veri değişmez).

| Test | Sonuç |
|---|---|
| Sıralı 10 istek | ort ≈ 0,35 sn (ağırlıkla coğrafi ağ RTT'si) |
| **Eşzamanlı 100 istek / paralellik 50** | **100/100 HTTP 200**, p50=0,33 sn, p95=0,35 sn, max=1,33 sn |

**Yorum:** Tek instance, 50 eşzamanlı bağlantıda hafif sorgular için **bozulmuyor** (p50 sabit). Bu, taban katmanın (ağ, DB SELECT 1, Redis ping) sağlıklı olduğunu gösterir — **ama gerçek yükü temsil etmez** (bcrypt/Google/AI yok). Gerçek kapasite ancak staging'de senaryo bazlı yük testiyle (k6/Artillery) ölçülebilir; production'da ağır uçları dövmek gerçek maliyet + gerçek kullanıcı etkisi yaratacağı için yapılmadı.

### 2.2 P1 sonrası canlı ölçüm
- `/restaurants/nearby` soğuk yükleme: **0,76 sn** (Sprint-15 P1 öncesi ~4–5 sn).

### 2.3 Statik mimari analizi (kod tabanı)
- 37 Prisma modeli, **48 `@@index`**, 21 unique kısıt — indeksleme erişim desenlerini (userId/placeId/status) iyi karşılıyor.
- Prisma istemci **varsayılan** (özel `connection_limit` yok). Varsayılan havuz ≈ `çekirdek×2+1`.
- `node src/app.js` — **clustering/PM2 yok** (tek çekirdek).
- Redis ioredis singleton, `fail-open` (cache opsiyonel).
- **Prompt caching açık** (`cache_control: ephemeral`, system + profil) → AI input maliyeti ~%90 düşük.
- **Compression (gzip) yok**.
- Tüm cron'lar **in-process node-cron**.

---

## 3. Darboğaz Analizi ve Öneriler

### 3.1 🔴 Uygulama sunucusu: tek process / SPOF
**Sorun:** Tek Node process = (1) tek CPU çekirdeği — bcrypt/JSON serileştirme event-loop'u bloke eder; (2) **tek hata noktası** — deploy/çökme = tam kesinti; redundans yok.
**Öneri:**
- **Yatay ölçekleme:** Railway'de backend servisini **2+ replikaya** çıkar (önce 2, izleyerek artır). Uygulama büyük ölçüde stateless (JWT, Redis cache).
- **Önce yatay ölçeklemeyi bloke eden 2 şeyi çöz** (3.5 ve 3.2'ye bak): in-process cron'lar ve DB bağlantı havuzu.
- Tek replika içinde Node `cluster`/PM2 yerine Railway replikası tercih edilir (operasyonel olarak basit).

### 3.2 🟠 Veritabanı: havuz tuning + PgBouncer
**Sorun:** Replika sayısı arttıkça `N × havuz` bağlantı Postgres `max_connections`'ı (küçük planlarda ~100) tüketebilir.
**Öneri:**
- `DATABASE_URL`'e **`connection_limit`** ekle (replika başına makul, ör. 5–10) → öngörülebilir toplam.
- Yatay ölçeklemeden önce **PgBouncer** (transaction pooling) koy — Railway'de eklenebilir; Prisma `pgbouncer=true` ile uyumlu.
- Postgres planını gözden geçir (vCPU/RAM/IOPS + `max_connections`). 10k için en az orta seviye instance.
- Ağır okuma uçlarını (analytics, sosyal feed) izleyip gerekirse **read-replica**'ya yönlendir (ileri faz).
- `pg_stat_statements` ile en yavaş sorguları profille.

### 3.3 🔴 Dış API maliyeti (en büyük finansal risk)
**Anthropic (AI öneri):** free=Haiku ($1/$5 per Mtok), premium=Sonnet ($3/$15). Prompt caching açık (cached input ~$0,10/Mtok).
- Kaba tahmin (DAU'nun %30'u AI kullanır, ~5k input / 1024 output token, caching ile):
  - Free Haiku ≈ **$0,003–0,01 / öneri** → 3.000/gün ≈ **$10–30/gün ($300–900/ay)**.
  - Premium Sonnet (sınırsız!) ≈ **$0,02–0,03 / öneri** → asıl risk burada; 1.000 premium × 5/gün ≈ **$100–150/gün ($3.000–4.500/ay)**.
**Öneri:**
- Premium "sınırsız"a **makul bir günlük tavan** (ör. 20–30/gün) + `aiRateLimit` zaten var; tavanı netleştir.
- **Yanıt caching:** aynı kullanıcı + aynı konum/bağlam için kısa süreli öneri cache'i (tekrar isteklerde Claude'a hiç gitme).
- **Model yönlendirme:** çoğu istek için Haiku; Sonnet'i yalnızca gerçekten gereken senaryolara.
- **Harcama izleme + alarm** (günlük $ eşiği).

**Google Places:** Nearby Search ~$32/1000, Details ~$17/1000, Photos ~$7/1000. `type=all` = **istek başına 5 Nearby çağrısı** (maliyet 5×).
- Redis cache (1 saat / ~110m tile) yoğun bölgelerde isabet oranını yükseltir; asıl maliyet seyrek/yeni bölgelerde.
**Öneri:**
- Cache tile'ını biraz genişlet (1 saat → 2–3 saat; 110m → 250m) ve **isabet oranını ölç**.
- `type=all` 5 çağrıyı azaltmayı değerlendir (ör. tek `restaurant` + isim/type türetme) — kaliteyi koruyarak maliyet 5×→1–2×.
- Google harcama alarmı + aylık $200 kredi takibi.

### 3.4 🟠 Redis: opsiyonelden yük-taşıyıcıya
**Sorun:** Bugün Redis fail-open (yoksa cache-miss). 10k'da Redis hem cache hem rate-limit hem sosyal sinyal için **kritik**; düşerse Google/Anthropic maliyeti patlar ve rate-limit fallback'leri devreye girer.
**Öneri:** Redis'i **yüksek erişilebilir + yeterli bellekli** plana al; bağlantı/health alarmı; `maxmemory-policy` (allkeys-lru) ayarı; bellek/eviction izleme.

### 3.5 🟠 Cron/arka plan işleri: bellek + replika çakışması
**Sorun:**
- `friendSuggestions` (gece 03:00): 10k viewer × 500 aday = ~5M skor (hızlı) **ama** 10k **sıralı** Redis yazımı + **tüm kullanıcı sinyallerini belleğe** yükleme → küçük instance'ta **bellek sıçraması/OOM** ve uzun süre.
- Tüm cron'lar **in-process** → backend 2+ replikaya çıkınca **her replika cron'u tekrar çalıştırır** (çift iş + yarış).
**Öneri:**
- Cron'ları **tek bir worker'a** taşı (ayrı Railway servisi) **veya** Redis tabanlı **leader-lock** ile yalnızca bir replika çalıştırsın.
- `friendSuggestions`: Redis yazımlarını **pipeline/batch** yap; sinyal yüklemeyi **şehir/parça bazında** böl (tüm kullanıcıyı tek seferde belleğe alma).

### 3.6 🟠 Gözlemlenebilirlik
**Sorun:** Sentry (hata) var; ama **performans metriği yok** (p95 latency, hata oranı, DB havuz doluluğu, dış-API harcaması, event-loop lag).
**Öneri:** Asgari panel — istek p50/p95, 5xx oranı, DB aktif bağlantı, Redis isabet oranı, Anthropic/Google günlük harcama; eşik alarmları. (Sentry Performance veya hafif bir metrics sink.)

### 3.7 🟢 Hızlı kazanımlar (düşük efor, anında fayda)
- **gzip/compression** middleware ekle → liste JSON'ları küçülür, mobilde hız.
- HTTP **keep-alive** + makul timeout ayarları.
- `connection_limit` + Prisma `$queryRaw` profilleme.

---

## 4. Maliyet Projeksiyonu (kaba, aylık, 10k DAU)

| Kalem | Tahmin/ay | Not |
|---|---|---|
| Railway backend (2 replika, orta) | $40–100 | Plan + kullanım |
| Postgres (orta + PgBouncer) | $20–60 | |
| Redis (yeterli bellek) | $15–40 | Yük-taşıyıcı oldu |
| **Anthropic (AI)** | **$300–4.500** | **En değişken; premium tavanına bağlı** |
| **Google Places** | **$100–800** | **Cache isabetine + type=all'a bağlı** |
| Resend (e-posta) | $0–20 | Doğrulama/şifre |
| Sentry/izleme | $0–30 | |
| **Toplam** | **~$500–5.500** | AI/Google kontrolleriyle alt banda çekilebilir |

> **Kritik mesaj:** Sunucu/DB maliyeti küçük; **bütçeyi AI + Google API belirliyor.** Tavan + caching + izleme olmadan bu kalemler öngörülemez büyür.

---

## 5. Önceliklendirilmiş Yol Haritası

### P0 — 10k'dan ÖNCE mutlaka (temel sağlamlık + maliyet güvenliği)
1. **AI maliyet tavanı + harcama alarmı** (premium günlük limit, öneri yanıt-cache, model yönlendirme netleştir).
2. **Google Places maliyet optimizasyonu** (cache tile genişlet + isabet ölç; `type=all` çağrı sayısını azalt).
3. **DB:** `connection_limit` + PgBouncer + Postgres plan gözden geçirme.
4. **Cron'ları replika-güvenli yap** (leader-lock veya ayrı worker) — yatay ölçeklemenin ön koşulu.
5. **Asgari metrik + alarm paneli** (p95, 5xx, DB havuz, API harcama).

### P1 — Ölçeklenme (P0 sonrası)
6. **Yatay ölçekleme: backend 2+ replika** (P0/4 tamamlanınca güvenli).
7. **friendSuggestions** bellek/batch refactor (pipeline + parça bazlı).
8. **gzip/compression** + keep-alive + Redis HA/bellek.
9. **Staging'de yük testi** (k6/Artillery, gerçek senaryolar: login, nearby, AI) — kapasiteyi sayısal doğrula.

### P2 — İleri optimizasyon (gerekirse)
10. Read-replica + ağır okuma uçlarını yönlendirme.
11. CDN/edge cache (statik + foto proxy).
12. AI için kuyruk/backpressure (ani talep patlamasında).

---

## 6. Doğrulanması Gereken Bilinmeyenler (kullanıcı/panel)

Rapor tahminlerini kesinleştirmek için Railway panelinden:
- Backend servis planı: **vCPU / RAM / replika sayısı**.
- Postgres planı: **vCPU / RAM / `max_connections` / disk**.
- Redis planı: **bellek / HA var mı**.
- Mevcut Anthropic + Google aylık **gerçek harcama** (varsa).
- Beklenen premium kullanıcı oranı (AI maliyetinin ana sürücüsü).

---

## 7. Sonuç ve Öneri

Mevcut altyapı **iyi tasarlanmış ve indeksli** ama **10k aktif kullanıcı için "olduğu gibi" hazır değil**. İyi haber: gereken işler **net ve sınırlı** — çoğu konfigürasyon/operasyon (replika, havuz, cron-lock, tavan, alarm) ve birkaç hedefli refactor. Çökme riskinden çok **(a) redundans eksikliği** ve **(b) kontrolsüz API maliyeti** öne çıkıyor.

**Önerilen aksiyon:** Yukarıdaki **P0 maddelerini bir "Sprint-16: Ölçeklenme Hazırlığı"** olarak ele alıp, her madde için gated issue/PR akışıyla ilerlemek. P0 bittiğinde 10k'ya güvenle çıkılır; P1 ile baş üstü (headroom) kazanılır.
