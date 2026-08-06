'use strict';

/**
 * E2E test veritabanı yaşam döngüsü.
 *
 * Bu paket GERÇEK bir Postgres'e karşı çalışır — mevcut `tests/integration` paketinden
 * temel farkı budur. Orada Prisma mock'lu olduğu için her çağrının dönüşü elle stub'lanır
 * ve çok adımlı bir akış test edilemez: 2. adım, 1. adımın gerçekten YAZDIĞI veriye
 * dayanamaz. Kullanıcı yolculuğu testinin tek anlamlı zemini gerçek bir veritabanıdır.
 */

const { execSync } = require('child_process');

/**
 * GÜVENLİK KİLİDİ — bu modül TRUNCATE çalıştırır.
 *
 * Yanlış bir `DATABASE_URL` ile çalıştırılması geliştirme ya da (daha kötüsü) üretim
 * verisini siler. Bu yüzden veritabanı adı açıkça test olduğunu söylemiyorsa modül
 * çalışmayı REDDEDER. Bu kontrolü gevşetmeyin; maliyeti sıfır, karşılığı geri
 * alınamaz bir veri kaybının önlenmesi.
 */
function assertTestDatabase(url) {
  if (!url) {
    throw new Error(
      'E2E testleri için DATABASE_URL tanımlı değil.\n' +
      'Örnek: DATABASE_URL="postgresql://postgres@127.0.0.1:5433/neareat_test"',
    );
  }

  let dbName;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`DATABASE_URL ayrıştırılamadı: ${url}`);
  }

  if (!/test/i.test(dbName)) {
    throw new Error(
      `GÜVENLİK: E2E paketi veritabanı tablolarını TRUNCATE eder ve "${dbName}" bir test ` +
      'veritabanı gibi görünmüyor (adında "test" geçmiyor). Yanlış veritabanına ' +
      'bağlanmış olabilirsiniz — işlem iptal edildi.',
    );
  }
  return dbName;
}

/** Migration'ları test veritabanına uygular (global setup'ta bir kez). */
function migrateTestDatabase(url) {
  assertTestDatabase(url);
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

/**
 * Tüm veri tablolarını boşaltır — testler arası izolasyon.
 *
 * Her testte migration'ı yeniden çalıştırmak yerine TRUNCATE kullanılır: şema aynı kalır,
 * yalnızca satırlar gider. `_prisma_migrations` KORUNUR, aksi halde Prisma şemayı
 * uygulanmamış sayardı.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function resetDatabase(prisma) {
  assertTestDatabase(process.env.DATABASE_URL);

  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (!rows.length) return;

  // Yabancı anahtarlar nedeniyle tek ifadede + CASCADE; RESTART IDENTITY sayaçları sıfırlar.
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { assertTestDatabase, migrateTestDatabase, resetDatabase };
