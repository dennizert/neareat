# Yük Testleri (k6) — S16-9

10k aktif kullanıcı hedefine karşı kapasiteyi **staging'de sayısal doğrular**. Sprint-16'nın
önceki tasklarındaki varsayımları (premium oranı, cache isabeti, replika sayısı, DB
bağlantı tavanı) gerçek yük altında ölçer.

> ⚠️ **YALNIZCA STAGING.** Scriptler production host'una koşmayı reddeder (`lib/guard.js`).
> Production'ı dövmek gerçek Anthropic/Google maliyeti + gerçek kullanıcı etkisi yaratır.

## Kurulum

[k6](https://k6.io/docs/get-started/installation/) gerekir (Node değil — ayrı ikili):
`winget install k6` / `brew install k6` / `choco install k6`.

## Senaryolar

| Script | Ne ölçer | Maliyet | Gereken env |
|---|---|---|---|
| `k6/browse.js` | Keşfet/nearby + arama + health (en sık yol) | ~0 (cache) | `BASE_URL` |
| `k6/login.js` | bcrypt CPU yükü (tek-çekirdek darboğazı) | 0 | `BASE_URL`,`EMAIL`,`PASSWORD` |
| `k6/ai.js` | AI öneri eşzamanlılığı | **Anthropic $** (düşük VU) | `BASE_URL`,`TOKEN` |

## Çalıştırma

```bash
# Tarama — kademeli yük (ramp-up)
k6 run -e BASE_URL=https://staging.example load-tests/k6/browse.js
k6 run -e BASE_URL=https://staging.example -e VUS=500 -e RAMP=1m -e HOLD=3m load-tests/k6/browse.js

# Login (düşük VU; authRateLimit'i staging'de gevşet)
k6 run -e BASE_URL=https://staging.example -e EMAIL=test@x.com -e PASSWORD=secret -e VUS=20 load-tests/k6/login.js

# AI (maliyet! tercihen Anthropic mock'lu staging)
k6 run -e BASE_URL=https://staging.example -e TOKEN=<jwt> load-tests/k6/ai.js
```

Parametreler (env): `BASE_URL` (zorunlu), `VUS`, `RAMP`, `HOLD`, `DURATION`, `LAT`, `LNG`.

## Kabul eşikleri (10k hedefi)

- `http_req_failed` **< %1** (browse/journey), AI < %5.
- `http_req_duration p(95)` **< 1.5s** (ağır AI uçları hariç).
- Doygunluk noktası: VU'yu kademeli artırıp p95/hata eğrisinin nerede bozulduğunu bul.

## S16-2 metrikleriyle korelasyon

Yük sürerken `GET /api/admin/metrics` (admin) ile **eş zamanlı** izle:
- `requests.p95`, `requests.errorRate`, `eventLoopLagMs.p95` (tek-çekirdek doygunluğu),
- `db.activeConnections` (PgBouncer/connection_limit altında mı — S16-7),
- `redis.hitRate`, `external.google`/`external.anthropic` (maliyet — S16-3/4).

Yorum: p95/event-loop-lag yükseliyorsa **replika ekle** (S16-8); `db.activeConnections`
tavana yaklaşıyorsa `connection_limit`/PgBouncer ayarla.

## Production guard

`lib/guard.js` — `BASE_URL` zorunlu (production'a default yok); bilinen production host'u
veya "production" içeren hedef reddedilir (kasıtlı kaçış: `ALLOW_PRODUCTION=true`). Saf JS,
jest ile test edilir (`tests/unit/loadTestGuard.test.js`).

## Maliyet kontrolü

- `browse` sabit koordinat kullanır → nearby ilk istekten sonra cache'ten (Google ~0).
- `ai` varsayılan 3 VU + kısa süre + S16-3 tavanına saygılı; yüksek eşzamanlılık ölçümü
  için Anthropic'i staging'de mock'la.
