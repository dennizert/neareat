'use strict';

/**
 * E2E ortam değişkenleri — uygulama modülleri YÜKLENMEDEN önce çalışır.
 *
 * Sıra kritik: `src/utils/prisma.js` istemciyi modül yüklenirken kurar ve `DATABASE_URL`'i
 * o anda okur. Bu dosya `setupFiles` (setupFilesAfterEnv DEĞİL) aşamasında çalıştığı için
 * uygulamanın herhangi bir parçası require edilmeden önce ortam hazır olur.
 */

process.env.NODE_ENV = 'test';

// Test veritabanı — CI'da service container, yerelde geliştiricinin Postgres'i.
// `tests/e2e/setup/database.js` adında "test" geçmeyen bir veritabanını REDDEDER.
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@127.0.0.1:5433/neareat_test';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

// Kimlik/dış servis env'leri — modül yüklenirken varlık kontrolü yapan SDK'lar için.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_e2e_dummy';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-e2e-dummy';
process.env.GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'e2e-dummy-key';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'e2e-project';
process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'e2e@test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
  || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg==\n-----END PRIVATE KEY-----\n';
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// Redis KASITLI olarak yapılandırılmadı: uygulama Redis'siz fail-open davranır ve
// E2E bu yolu kullanır. Ölçüldü — mevcut yolculuklar Redis'e HİÇ yazmıyor (koşu öncesi
// ve sonrası `dbsize` 0), çünkü cache'li uçlar (nearby, AI önerisi) bu yolculukların
// konusu değil. Bu yüzden CI'a Redis servisi eklemek bugün sıfır kapsam kazandırırdı.
// Cache davranışına dayanan bir yolculuk yazılırsa REDIS_URL verilmesi yeterli
// (gerçek Redis'le de 21/21 yeşil doğrulandı) ve o zaman CI'a servis eklenmeli.

// NOT — HIZ LİMİTİ BÜTÇESİ: uygulamanın rate limit'i test modunda KAPATILMAZ (bazı
// mevcut testler 429 davranışına dayanıyor, üretim kodunu test için gevşetmek doğru
// olmazdı). Jest her test DOSYASINA ayrı bir modül kaydı verdiğinden limit sayaçları
// dosya başına sıfırlanır; geçerli bütçe dosya başına ~120 `/api` isteği ve ~20
// `/api/auth` isteğidir. Yolculuklar bu bütçeye göre bölünmeli — bir dosya şişerse
// yeni bir `.e2e.js` dosyasına ayırın.
