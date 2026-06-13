'use strict';

/**
 * Üretim migration adımı (S16-7) — `node prisma/deploy.js && node src/app.js`.
 *
 * Neden: PgBouncer (transaction pooling) ile uyum için Prisma şeması `directUrl =
 * env("DIRECT_URL")` kullanır; migration'lar pooler yerine DOĞRUDAN DB'ye gider
 * (pooler bazı DDL/advisory-lock işlemlerini desteklemez). PgBouncer henüz
 * yapılandırılmadıysa DIRECT_URL set DEĞİLDİR ve `prisma migrate deploy` "env DIRECT_URL
 * not found" ile patlar. Bu script DIRECT_URL'i DATABASE_URL'e default'lar → PgBouncer
 * yokken mevcut davranış birebir korunur; varken (DATABASE_URL=pooler, DIRECT_URL=direct)
 * migration doğrudan, runtime pooler üzerinden çalışır.
 *
 * Cross-platform (Node) — shell `export`/`${VAR:-...}` taşınabilirlik sorunlarını önler.
 */

process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const { execSync } = require('child_process');

function run(cmd, ignoreError = false) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    if (!ignoreError) throw err;
  }
}

// P3009 savunması: önceki başarısız migration kaydını geri al (zaten temizse hatayı yoksay).
run('npx prisma migrate resolve --rolled-back 20260511120000_add_messages_and_reports', true);
// Bekleyen migration'ları uygula (DIRECT_URL üzerinden).
run('npx prisma migrate deploy');
