'use strict';

/**
 * E2E global setup — tüm paket için BİR KEZ çalışır.
 *
 * Migration'ları burada uygulamak, her test dosyasında tekrarlamaktan hem çok daha
 * hızlıdır hem de şemanın gerçekten uygulanabilir olduğunu paketin en başında doğrular:
 * bozuk bir migration, ilk yolculuk testinin anlamsız bir hatasıyla değil, net bir
 * kurulum hatasıyla ortaya çıkar.
 */

const { migrateTestDatabase, assertTestDatabase } = require('./database');

module.exports = async () => {
  // `setupFiles` global setup'tan SONRA çalıştığı için varsayılanı burada da veriyoruz.
  const url = process.env.DATABASE_URL
    || 'postgresql://postgres:postgres@127.0.0.1:5433/neareat_test';
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.DIRECT_URL || url;

  assertTestDatabase(url);

  try {
    migrateTestDatabase(url);
  } catch (err) {
    const detail = err.stderr?.toString() || err.stdout?.toString() || err.message;
    throw new Error(
      'E2E test veritabanına bağlanılamadı veya migration uygulanamadı.\n\n' +
      `DATABASE_URL: ${url}\n\n` +
      'Postgres çalışıyor mu? Kurulum için: tests/e2e/README.md\n\n' +
      `Ayrıntı: ${detail}`,
    );
  }
};
