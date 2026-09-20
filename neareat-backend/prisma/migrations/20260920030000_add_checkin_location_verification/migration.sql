-- S18-3 devamı: check-in'e konum doğrulaması. Hepsi idempotent.
-- CheckIn satırı `starGuards.hasVerifiedVisit`in ziyaret kanıtıdır; konum doğrulaması
-- olmadan gövdeye rastgele bir placeId yazmak yıldız farming'i için yeterliydi.

ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "distance_meters" INTEGER;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "mocked" BOOLEAN NOT NULL DEFAULT false;

-- DİKKAT — geriye dönük hak kaybı olmasın diye iki adımda ekleniyor:
-- kolon önce DEFAULT true ile eklenir (mevcut satırlar "grandfather"lanır: eski
-- kurallar altında oluşturuldular, kazanılmış seviye erişimini geri almak yanlış olur),
-- sonra default false'a çevrilir ki YENİ satırlar doğrulama gerektirsin.
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "check_ins" ALTER COLUMN "verified" SET DEFAULT false;

-- hasVerifiedVisit sorgusu: (user_id, place_id, verified)
CREATE INDEX IF NOT EXISTS "check_ins_user_id_place_id_verified_idx"
  ON "check_ins" ("user_id", "place_id", "verified");
