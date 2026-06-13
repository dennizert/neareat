# Yatay Ölçekleme & Redis HA Kılavuzu (S16-8)

Backend'i 2+ replikaya çıkararak **redundans** (SPOF kaldırma) + paralel CPU sağlar.
**Ön koşullar tamam:** S16-6 (cron leader-lock) ve S16-7 (DB pool/PgBouncer).

## Kod tarafı (bu repoda hazır)

- **Graceful shutdown + readiness drain** (`src/app.js` + `utils/readiness.js`):
  SIGTERM/SIGINT'te `setShuttingDown(true)` → `/health` **503 `shutting_down`** döner →
  LB yeni isteği başka replikaya yönlendirir; mevcut bağlantılar `server.close()` ile
  drain edilir (10s force-exit emniyeti).
- **Healthcheck** (`railway.toml`): `healthcheckPath = "/health"` → rolling deploy'da
  yeni replika 200 dönene kadar trafik eski replikada kalır (kesintisiz).
- **Replika-güvenli durum:**
  - Cron'lar leader-lock'lu (S16-6) → tek replikada çalışır.
  - DB bağlantıları PgBouncer/connection_limit ile sınırlı (S16-7).
  - Oturum JWT (stateless) — herhangi bir replika doğrular.
  - Rate-limit/cache/social-signals Redis-merkezli (replikalar paylaşır).
  - **Bilinçli per-replika** (kabul edilebilir): metrik (`/api/admin/metrics` hangi
    replikaya düşerse onu gösterir) ve `aiRateLimit` in-memory fallback'i (yalnızca
    Redis düştüğünde devreye girer; fail-closed düşük tavan → çok-replikada en kötü
    ihtimalle `replika × fallback` istek, yine de maliyet freni).

## Railway adımları (OPS, kullanıcı)

1. Backend servisi → **Settings → Deploy → Replicas** = **2** (önce 2; metrikle izleyerek
   artır). Railway aynı imajı N replika çalıştırır, yük dengeler.
2. **Redis sağlamlaştırma** (Redis servisi):
   - Yeterli bellekli plan seç (cache + rate-limit + social-signals + cron-lock yük taşır).
   - `maxmemory-policy = allkeys-lru` (bellek dolunca çökme yerine en az kullanılanı at).
   - Mümkünse HA/replication seçeneği.
3. **Doğrula (canlı):**
   - Tüm replikalarda `/health` 200 (Railway healthcheck yeşil).
   - **Failover:** bir replikayı yeniden başlat → servis erişilebilir kalır.
   - **Cron tekilliği:** loglarda her cron tek "[cron] <job> kilidi alındı" + diğer
     replikada "atlandı" görünür; mükerrer bildirim YOK.
   - **DB:** `GET /api/admin/metrics → db.activeConnections` `max_connections` altında.
   - **Rolling deploy:** yeni sürüm deploy'unda 5xx artışı minimum (drain çalışır).

## Ne zaman replika eklemeli?

`GET /api/admin/metrics` ile izle: `requests.p95` yükseliyor, `eventLoopLagMs.p95` >
~200ms, ya da 5xx artıyorsa replika ekle. Tek çekirdek (bcrypt/JSON) doyduğunda yatay
ölçekleme en etkili çözümdür.

## Otomatik auto-scaling
Şimdilik sabit 2–3 replika + metrik. Talep çok değişkense ileride auto-scaling (P2).

İlgili: `OLCEKLENEBILIRLIK_RAPORU_10K.md`, `docs/DB_POOL_PGBOUNCER.md`, S16-2 metrik, S16-6 cron-lock.
