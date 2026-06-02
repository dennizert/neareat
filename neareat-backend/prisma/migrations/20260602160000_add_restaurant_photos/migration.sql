-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RestaurantPhotoKind" AS ENUM ('RESTAURANT', 'PRODUCT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "restaurant_photos" (
    "id" TEXT NOT NULL,
    "restaurant_profile_id" TEXT NOT NULL,
    "kind" "RestaurantPhotoKind" NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "restaurant_photos_restaurant_profile_id_kind_idx" ON "restaurant_photos"("restaurant_profile_id", "kind");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "restaurant_photos" ADD CONSTRAINT "restaurant_photos_restaurant_profile_id_fkey" FOREIGN KEY ("restaurant_profile_id") REFERENCES "restaurant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
