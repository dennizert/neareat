-- AlterEnum: IF NOT EXISTS → önceki deploy'da kısmen çalışmış olsa bile güvenli
ALTER TYPE "StarEventType" ADD VALUE IF NOT EXISTS 'RESERVATION';
ALTER TYPE "StarEventType" ADD VALUE IF NOT EXISTS 'RESERVATION_ATTENDED';

-- CreateEnum: DO bloğu → tip zaten varsa sessizce devam et
DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: IF NOT EXISTS → kolon zaten varsa hata verme
ALTER TABLE "restaurant_profiles" ADD COLUMN IF NOT EXISTS "accepts_reservations" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: IF NOT EXISTS → tablo zaten varsa atla
CREATE TABLE IF NOT EXISTS "reservations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "place_name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "occasion" VARCHAR(100),
    "special_requests" VARCHAR(500),
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" VARCHAR(500),
    "attended" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservation_messages" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IF NOT EXISTS → index zaten varsa atla
CREATE INDEX IF NOT EXISTS "reservations_user_id_idx" ON "reservations"("user_id");
CREATE INDEX IF NOT EXISTS "reservations_restaurant_id_status_idx" ON "reservations"("restaurant_id", "status");
CREATE INDEX IF NOT EXISTS "reservations_place_id_idx" ON "reservations"("place_id");
CREATE INDEX IF NOT EXISTS "reservation_messages_reservation_id_idx" ON "reservation_messages"("reservation_id");

-- AddForeignKey: constraint zaten varsa DO bloğu exception'ı yakalar
DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_fkey"
    FOREIGN KEY ("restaurant_id") REFERENCES "restaurant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "reservation_messages" ADD CONSTRAINT "reservation_messages_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
