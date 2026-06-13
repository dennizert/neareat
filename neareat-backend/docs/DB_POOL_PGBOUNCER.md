# DB Bağlantı Havuzu & PgBouncer Kurulum Kılavuzu (S16-7)

10k aktif kullanıcı için backend yatay olarak ölçeklendiğinde (S16-8, 2+ replika)
`N replika × Prisma havuzu` bağlantı Postgres `max_connections`'ı tüketebilir. Bu
kılavuz bağlantıları öngörülebilir kılar.

## Kod tarafı (bu repoda hazır)

- **`schema.prisma`**: `url = env("DATABASE_URL")` (runtime) + `directUrl = env("DIRECT_URL")`
  (migration). Migration'lar pooler yerine doğrudan DB'ye gider (PgBouncer transaction
  modu bazı DDL/advisory-lock işlemlerini desteklemez).
- **`prisma/deploy.js`** (start adımı): PgBouncer yapılandırılmadıysa `DIRECT_URL`'i
  `DATABASE_URL`'e default'lar → mevcut davranış birebir korunur. Start komutu:
  `node prisma/deploy.js && node src/app.js` (hem `package.json` hem `railway.toml`).
- **Bağlantı metriği**: `GET /api/admin/metrics` → `db.activeConnections` (canlı
  `pg_stat_activity` sayımı, S16-2).

## connection_limit formülü

Toplam DB bağlantısı = `replika sayısı × connection_limit (+ migration/diğer)`.
Postgres `max_connections`'ın altında kalmalı (küçük planlarda ~100; PgBouncer'ın
kendi backend bağlantıları için de pay bırak).

```
connection_limit ≈ floor( (max_connections × 0.8) / beklenen_replika )
```

Örnek: `max_connections=100`, 3 replika → `connection_limit ≈ 26`. Daha muhafazakâr
başla (ör. **10**) ve `db.activeConnections` metriğiyle izleyerek artır.

`DATABASE_URL`'e ekle: `...?connection_limit=10` (PgBouncer ile: `...?pgbouncer=true&connection_limit=10`).

## PgBouncer — Railway adımları (OPS, kullanıcı)

> PgBouncer **transaction pooling** modu çok sayıda kısa bağlantıyı az sayıda gerçek
> DB bağlantısına çoğullar → replika eklemek DB tarafında ayar gerektirmez.

1. **Railway → "railway up" projesi → + New → Database/Plugin → PgBouncer** (veya
   PgBouncer şablonu) ekle; aynı Postgres'e bağla.
2. PgBouncer'ın **pooler bağlantı dizesini** al (transaction mode, genelde port 6432).
3. Backend servisi → **Variables**:
   - `DATABASE_URL` = **PgBouncer pooler URL** + `?pgbouncer=true&connection_limit=10`
     (runtime bunu kullanır).
   - `DIRECT_URL` = **doğrudan Postgres URL** (`${{Postgres.DATABASE_URL}}`) — migration
     bunu kullanır.
4. Deploy et. `node prisma/deploy.js` migration'ları `DIRECT_URL` ile uygular; runtime
   pooler üzerinden çalışır.
5. **Doğrula**: `GET /api/admin/metrics` → `db.activeConnections` replika×connection_limit
   civarında ve `max_connections` altında olmalı. `/health` 200.

### Geri alma
PgBouncer'ı devre dışı bırakmak için `DATABASE_URL`'i tekrar doğrudan Postgres'e
çevir ve `DIRECT_URL`'i kaldır (deploy.js DATABASE_URL'e default'lar). Kod değişikliği
gerekmez.

## Postgres planı gözden geçirme

- `max_connections`, vCPU/RAM, disk/IOPS'u plan panelinden kontrol et; 10k için en az
  orta seviye.
- En yavaş sorguları profillemek için `pg_stat_statements` uzantısını etkinleştir.

İlgili: `OLCEKLENEBILIRLIK_RAPORU_10K.md` (rapor), S16-2 metrik, S16-8 yatay ölçekleme.
