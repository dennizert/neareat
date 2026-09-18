-- Sıcak sorgular için eksik bileşik indeksler. Hepsi idempotent.
-- İsimler Prisma konvansiyonuyla birebir (tablo_kolonlar_idx) — aksi halde şema drift'i olur.

-- jobs/subscriptionReminders: günlük status='trial' + expiresAt aralığı taraması.
CREATE INDEX IF NOT EXISTS "subscriptions_status_expires_at_idx"
  ON "subscriptions" ("status", "expires_at");

-- registeredProfileWhere: nearby/detail/rezervasyon zenginleştirmesinde placeId + APPROVED.
-- Uygulamanın en sık çalışan sorgusu; placeId ve status ayrı indekslerdeydi.
CREATE INDEX IF NOT EXISTS "restaurant_profiles_place_id_status_idx"
  ON "restaurant_profiles" ("place_id", "status");

-- Slot kapasite sayımı: her rezervasyon denemesinde placeId+date+time ile count.
CREATE INDEX IF NOT EXISTS "reservations_place_id_date_time_idx"
  ON "reservations" ("place_id", "date", "time");

-- Doluluk/uygunluk: restaurantId+date+status. Mevcut [restaurant_id, status] date'i
-- kapsamadığı için restoranın tüm geçmişini tarıyordu.
CREATE INDEX IF NOT EXISTS "reservations_restaurant_id_date_status_idx"
  ON "reservations" ("restaurant_id", "date", "status");

-- Aylık rezervasyon kotası: userId + createdAt >= ay başı.
CREATE INDEX IF NOT EXISTS "reservations_user_id_created_at_idx"
  ON "reservations" ("user_id", "created_at");
