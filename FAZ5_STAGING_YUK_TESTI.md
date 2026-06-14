# FAZ 5 — Staging Yük Testi Runbook (lansmana yakın)

10k aktif kullanıcı hedefine karşı kapasiteyi **staging'de sayısal doğrular** ve
doygunluk noktasını (p95/hata hangi yükte bozuluyor) bulur. Büyük lansmandan
**1-2 hafta önce** çalıştır.

> ⚠️ **PRODUCTION'A ASLA KOŞMA.** k6 scriptleri `load-tests/lib/guard.js` ile
> production host'unu reddeder. Ayrı bir staging ortamı şart.

İlgili kod: `neareat-backend/load-tests/` (k6 scriptleri + guard + README).

---

## Adım 1 — Staging ortamı oluştur (Railway Environments)

1. Railway → proje → üstteki **ortam seçici** (genelde "production") → **"+ New Environment"** → ad: **`staging`**.
2. Railway production'ı **duplicate** eder → ayrı **backend + Postgres + Redis** (production'a dokunmaz, ayrı veri).
3. Staging **backend** servisi → **Settings → Networking → Generate Domain** → public URL al (ör. `https://neareat-staging-xxxx.up.railway.app`). Bunu `<STAGING>` olarak kullanacağız.
4. İlk deploy'da `prisma/deploy.js` migration'ları staging'in (boş) DB'sine uygular.
5. (Önemli) Staging backend env'lerini kontrol et: `DATABASE_URL`/`REDIS_URL` staging servislerine işaret etmeli (duplicate genelde otomatik ayarlar). `PREMIUM_AI_DAILY_CAP`, `ALARM_*` staging'de de olsun ki metrik/limit davranışı production'la aynı olsun.

## Adım 2 — Staging'e test verisi + premium kullanıcı

Staging DB boş. Login/AI senaryoları için:

```powershell
# 2a) Test kullanıcısı oluştur
Invoke-RestMethod -Method Post -Uri "https://<STAGING>/api/auth/register" `
  -ContentType "application/json" `
  -Body '{"email":"loadtest@x.com","password":"Test12345!","displayName":"Load Test"}'

# 2b) Login → JWT al (AI senaryosu için lazım)
$u = Invoke-RestMethod -Method Post -Uri "https://<STAGING>/api/auth/login/email" `
  -ContentType "application/json" `
  -Body '{"email":"loadtest@x.com","password":"Test12345!"}'
$u.token   # <STAGING-JWT>
```

**AI testi maliyet üretir** → staging'de bu hesabı premium yap (tavan S16-3 ile yine sınırlı):
- En kolay: staging backend env'ine `ALWAYS_PREMIUM_EMAILS=loadtest@x.com` ekle → redeploy.
- Alternatif: DBeaver ile staging DB'ye bağlan → `subscription` tablosuna active kayıt ekle.

> Maliyet istemiyorsan: AI senaryosunu ATLA, sadece browse + login koş (Anthropic'i staging'de mock'lamak için kod yok; mock istersen ayrı bir env-gate eklemek gerekir).

## Adım 3 — k6 kur

```powershell
winget install k6        # veya: choco install k6
k6 version               # doğrula
```

## Adım 4 — Senaryoları çalıştır (kademeli)

```powershell
cd C:\projects\firstproject\neareat-backend

# 4a) Tarama (maliyetsiz) — önce hafif, sonra ağır
k6 run -e BASE_URL=https://<STAGING> load-tests/k6/browse.js
k6 run -e BASE_URL=https://<STAGING> -e VUS=500 -e RAMP=1m -e HOLD=3m load-tests/k6/browse.js
k6 run -e BASE_URL=https://<STAGING> -e VUS=1000 -e RAMP=2m -e HOLD=3m load-tests/k6/browse.js

# 4b) Login (bcrypt — tek-çekirdek darboğazı). authRateLimit'i staging'de gevşet
#     (backend env: authLimiter max'ı geçici artır) yoksa 429'lar gelir.
k6 run -e BASE_URL=https://<STAGING> -e EMAIL=loadtest@x.com -e PASSWORD=Test12345! -e VUS=20 load-tests/k6/login.js
k6 run -e BASE_URL=https://<STAGING> -e EMAIL=loadtest@x.com -e PASSWORD=Test12345! -e VUS=50 load-tests/k6/login.js

# 4c) AI (MALİYET — düşük VU). Premium hesap + JWT ile
k6 run -e BASE_URL=https://<STAGING> -e TOKEN=<STAGING-JWT> load-tests/k6/ai.js
```

Parametreler: `BASE_URL`(zorunlu), `VUS`, `RAMP`, `HOLD`, `DURATION`, `LAT`, `LNG`.

## Adım 5 — Eş zamanlı metrik izle

Yük SÜRERKEN, ikinci bir terminalde staging admin token'ıyla metriği örnekle:

```powershell
# staging admin (ALWAYS_PREMIUM hesabını admin yapmadıysan ayrı bir admin gerekir;
# DBeaver staging: UPDATE users SET role='ADMIN' WHERE email='loadtest@x.com';)
$la = Invoke-RestMethod -Method Post -Uri "https://<STAGING>/api/admin/login" -ContentType "application/json" -Body '{"email":"loadtest@x.com","password":"Test12345!"}'
1..20 | % {
  $r = Invoke-RestMethod -Uri "https://<STAGING>/api/admin/metrics" -Headers @{Authorization="Bearer $($la.token)"}
  "p95={0} 5xx-rate={1} eloop_p95={2} db={3} g=${4}" -f $r.requests.p95, $r.requests.errorRate, $r.eventLoopLagMs.p95, $r.db.activeConnections, $r.external.google.costUsd
  Start-Sleep 5
}
```

## Adım 6 — Yorumla (kabul kriterleri + karar)

| Sinyal | Eşik / yorum |
|---|---|
| k6 `http_req_failed` | **< %1** (browse/login), AI < %5 |
| k6 `http_req_duration p(95)` | **< 1.5s** (ağır AI hariç) |
| metrik `eventLoopLagMs.p95` | > ~200ms → tek çekirdek doyuyor → **replika ekle** |
| metrik `db.activeConnections` | tavana (100) yaklaşıyor → **PgBouncer (3b)** |
| metrik `external.google/anthropic` | maliyet projeksiyonu → tavan/cache ayarı |

**Doygunluk noktasını bul:** VU'yu 200→500→1000→… kademeli artır, p95/hata eğrisinin
**nerede bozulduğunu** kaydet. Bu nokta = mevcut replika/plan ile maks kapasite.
10k DAU tepe ≈ 40-90 RPS olduğundan, bu RPS'i sağlıklı (p95<1.5s, hata<%1) taşıyan
replika sayısını belirle → production replika/plan kararı.

## Adım 7 — Temizlik

- Test bittiğinde staging ortamını **sil** (Railway → staging environment → Settings → Delete) ki boşuna maliyet biriktirmesin.
- Bulguları (doygunluk noktası, önerilen replika sayısı) `project_scalability_10k` memory'sine / bu dosyaya not düş.

---

## Notlar
- Bu runbook lansmana yakın çalıştırılır; mevcut metrikler (event-loop lag ≈ 0, db 4/100)
  şu an CPU/DB baskısı olmadığını gösteriyor — acil değil.
- AI senaryosu gerçek Anthropic maliyeti üretir; düşük VU + premium tavan (S16-3) ile sınırlı tut.
- Production'a koşmaya çalışırsan guard reddeder (`ALLOW_PRODUCTION=true` ile zorlanabilir — YAPMA).

İlgili: `OLCEKLENEBILIRLIK_RAPORU_10K.md`, `neareat-backend/load-tests/README.md`, `docs/HORIZONTAL_SCALING.md`, `docs/DB_POOL_PGBOUNCER.md`.
