-- S19-2: koltuk kapasitesi + rezerve koltuk (zaman-dilimi bazli doluluk).
ALTER TABLE "restaurant_profiles" ADD COLUMN IF NOT EXISTS "seat_capacity" INTEGER;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "reserved_seats" INTEGER;
