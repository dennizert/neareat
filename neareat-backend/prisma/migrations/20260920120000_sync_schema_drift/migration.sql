-- DB08 — şema drift'i: canlı DB ile schema.prisma'yı eşitle. Hepsi idempotent.
--
-- `prisma migrate diff` 9 tabloda fark gösteriyordu. Bu migration KASITLI OLARAK
-- farkın yalnızca iki bölümünü uyguluyor; gerisi DB'nin değil ŞEMANIN düzeltilmesiyle
-- kapatıldı (aynı PR'da schema.prisma'ya bakın). Gerekçe her blokta yazılı.
--
-- UYGULANMAYANLAR ve NEDENİ — diff bunları öneriyordu, bilerek almadık:
--   * `ALTER COLUMN id DROP DEFAULT` (notification_preferences, place_requests,
--     recommendation_feedback): DB'deki `gen_random_uuid()` varsayılanı zararsız bir
--     emniyet ağı. Prisma id'yi istemcide üretiyor, yani varsayılan hiç kullanılmıyor;
--     ama Prisma dışı her insert (raw SQL, seed, elle onarım) onu düşürürsek NOT NULL
--     ihlaliyle patlar. Kozmetik bir diff satırı için çalışan bir emniyeti sökmek yanlış.
--   * `ALTER COLUMN updated_at/created_at SET DATA TYPE TIMESTAMP(3)`: mevcut kolonlar
--     TIMESTAMP(6). (3)'e çevirmek mikrosaniyeleri KESER (veri kaybı) ve tabloyu
--     yeniden yazar. Daha hassas olan hâli tutmak daha iyi; şema tarafı `@db.Timestamp(6)`
--     ile gerçeğe uyduruldu.
--   * FK'lerin DROP+ADD'i (recommendation_feedback ×2, notification_preferences,
--     place_requests): tek fark `ON UPDATE` — DB'de NO ACTION, Prisma varsayılanı
--     CASCADE. ON UPDATE yalnızca REFERANS EDİLEN birincil anahtar değişirse tetiklenir;
--     bunlar hiç güncellenmeyen UUID PK'lar, yani davranışsal olarak no-op. Karşılığında
--     iki tabloda ACCESS EXCLUSIVE kilit + ADD CONSTRAINT'te tam tablo doğrulaması
--     gerekiyordu. Risk var, kazanç yok → şemaya `onUpdate: NoAction` yazıldı.

-- ─── 1) Eksik indeksler — farkın gerçek değer taşıyan tek kısmı ───────────────
-- Dördü de schema.prisma'da @@index olarak TANIMLI ama canlıda yok: indeksleri
-- ekleyen migration'lar yazılırken bu dört tanesi atlanmış.
--
-- NOT (canlı): `CREATE INDEX` (CONCURRENTLY değil) tablo üzerinde SHARE kilidi alır →
-- indeks kurulurken o tabloya YAZMA bloklanır, okuma serbest. Bu tablolar bu ölçekte
-- küçük olduğu için süre milisaniyeler mertebesinde. Tablolar milyonlarca satıra
-- ulaşırsa CONCURRENTLY gerekir; o da transaction içinde çalışamaz, yani Prisma
-- migration'ı dışında elle yürütülmelidir.

-- discoveryController + favoriteController: "bu mekânı kimler favorilemiş" ve
-- placeId bazlı favori sayımı.
CREATE INDEX IF NOT EXISTS "favorites_place_id_idx" ON "favorites" ("place_id");

-- reviewController + utils/appRating: bir mekânın tüm uygulama-içi yorumları.
-- placeId'ye göre okuma bu tablonun en sık sorgusu, indeksi hiç yoktu.
CREATE INDEX IF NOT EXISTS "reviews_place_id_idx" ON "reviews" ("place_id");

-- socialService: kullanıcının gönderdiği öneriler, tarihe göre sıralı.
CREATE INDEX IF NOT EXISTS "recommendations_from_user_id_created_at_idx"
  ON "recommendations" ("from_user_id", "created_at");

-- starGuards + referralReward idempotency: (userId, type, referenceId) üçlüsüyle
-- "bu ödül daha önce verildi mi" kontrolü. S18-3 yıldız zincirinin sıcak sorgusu.
CREATE INDEX IF NOT EXISTS "star_events_user_id_type_reference_id_idx"
  ON "star_events" ("user_id", "type", "reference_id");

-- ─── 2) FK adlarını Prisma konvansiyonuna getir ───────────────────────────────
-- Yalnızca AD değişiyor: bu iki kısıt zaten ON DELETE/UPDATE CASCADE ve öyle kalıyor.
-- RENAME CONSTRAINT salt katalog işlemi — tablo taranmaz, anında biter.
-- Neden yapılıyor: gürültülü bir `migrate diff` gerçek drift'i gizler. Bedava
-- susturulabilen iki satırı susturuyoruz.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_reports_reported_fkey' AND conrelid = 'user_reports'::regclass
  ) THEN
    ALTER TABLE "user_reports"
      RENAME CONSTRAINT "user_reports_reported_fkey" TO "user_reports_reported_id_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_reports_reporter_fkey' AND conrelid = 'user_reports'::regclass
  ) THEN
    ALTER TABLE "user_reports"
      RENAME CONSTRAINT "user_reports_reporter_fkey" TO "user_reports_reporter_id_fkey";
  END IF;
END $$;
