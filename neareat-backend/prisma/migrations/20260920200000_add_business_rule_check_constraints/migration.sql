-- DB04/05 (#461) — iş kuralı sınırlarını DB seviyesinde de zorunlu kıl.
-- Derinlemesine savunma: bugün sömürülebilir bir yol YOK (HTTP katmanı doğruluyor),
-- ama uygulama tek savunma hattı olduğu için gelecekteki bir kod yolu, raw SQL, seed
-- ya da elle onarım sessizce geçersiz veri yazabilir.
--
-- ─── NEDEN HEPSİ `NOT VALID` ───────────────────────────────────────────────────
-- Düz bir CHECK, tabloda ihlalli TEK bir satır varsa migration'ı düşürür. `npm start`
-- migration çalıştırdığı için bu, uygulamanın HİÇ AÇILMAMASI demektir — bir sertleştirme
-- işi için kabul edilemez bir risk. `NOT VALID` mevcut satırları taramaz, yalnızca
-- BUNDAN SONRAKİ yazımları denetler. Postgres 18.6'da ölçüldü:
--     INSERT star_count = -999                        → başarılı
--     ALTER TABLE ... CHECK (...) NOT VALID           → başarılı (ihlal varken bile)
--     INSERT star_count = -5                          → ERROR, kısıt devrede
--
-- ─── CANLIDA SONRADAN DOĞRULAMA (bu migration'ın işi DEĞİL) ────────────────────
-- Kısıtları geçmişe de uygulamak istenirse, ÖNCE ihlal var mı bakılmalı:
--     SELECT count(*) FROM reviews WHERE rating NOT BETWEEN 1 AND 5;
--     SELECT count(*) FROM users WHERE star_count < 0;
--     ... (her kısıt için)
-- Sıfırsa doğrulanabilir (SHARE UPDATE EXCLUSIVE kilit alır, yazmaları BLOKLAMAZ):
--     ALTER TABLE reviews VALIDATE CONSTRAINT reviews_rating_range;
-- İhlal varsa önce veri düzeltilmeli — o ayrı bir iştir.
--
-- ─── KAPSAM DIŞI: zamana bağlı kurallar ────────────────────────────────────────
-- "Kullanıcının tek aktif check-in'i olmalı" ve "geçmiş tarihe rezervasyon olmaz"
-- CHECK/indeks ile İFADE EDİLEMEZ. Ölçüldü:
--     CREATE UNIQUE INDEX ... ON check_ins (user_id) WHERE expires_at > now();
--     ERROR: functions in index predicate must be marked IMMUTABLE
-- "Aktif" ve "geçmiş" tanımları zamana bağlı; ayrıca bir rezervasyon zaman geçtikçe
-- MEŞRU şekilde geçmiş olur. Bu kurallar uygulama katmanında kalır.
--
-- Sınırlar HTTP katmanındaki doğrulamayla BİREBİR aynı — daha dar bir sınır meşru
-- veriyi reddederdi. Nullable alanlarda NULL kabul edilir.

DO $$
BEGIN
  -- reviews.rating: validation/schemas.js → zod .min(1).max(5) (create + update)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_range') THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
  END IF;

  -- users.star_count: utils/stars.deductStars zaten Math.max(0, …) ile tabanı 0'a
  -- sıkıştırıyor; negatif bir değer her zaman hatadır.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_star_count_non_negative') THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_star_count_non_negative" CHECK ("star_count" >= 0) NOT VALID;
  END IF;

  -- reservations.guest_count: reservationService.createReservation → 1-50
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_guest_count_range') THEN
    ALTER TABLE "reservations"
      ADD CONSTRAINT "reservations_guest_count_range" CHECK ("guest_count" BETWEEN 1 AND 50) NOT VALID;
  END IF;

  -- reservations.reserved_seats: updateReservationStatus → 1-5000. NULL = koltuk
  -- henüz belirlenmemiş (onay öncesi), meşru.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_reserved_seats_range') THEN
    ALTER TABLE "reservations"
      ADD CONSTRAINT "reservations_reserved_seats_range"
      CHECK ("reserved_seats" IS NULL OR "reserved_seats" BETWEEN 1 AND 5000) NOT VALID;
  END IF;

  -- restaurant_profiles.seat_capacity: restaurantAccountService → 1-5000. NULL =
  -- kapasite tanımsız (doluluk bandı gösterilmez), meşru.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_profiles_seat_capacity_range') THEN
    ALTER TABLE "restaurant_profiles"
      ADD CONSTRAINT "restaurant_profiles_seat_capacity_range"
      CHECK ("seat_capacity" IS NULL OR "seat_capacity" BETWEEN 1 AND 5000) NOT VALID;
  END IF;
END $$;
