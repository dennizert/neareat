-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'RESTAURANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "restaurant_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "tax_number" TEXT NOT NULL,
    "tax_office" TEXT NOT NULL,
    "tax_certificate_data" TEXT,
    "phone" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "business_category" TEXT NOT NULL,
    "place_id" TEXT,
    "place_name" TEXT,
    "place_address" TEXT,
    "place_photo_url" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "approved_at" TIMESTAMP(3),
    "reviewed_by_admin_id" TEXT,
    "reservation_url" TEXT,
    "announcement" VARCHAR(500),
    "announcement_active" BOOLEAN NOT NULL DEFAULT false,
    "opening_hours" JSONB,
    "discount_enabled" BOOLEAN NOT NULL DEFAULT false,
    "discount_percent" DOUBLE PRECISION,
    "discount_min_stars" INTEGER,
    "discount_note" VARCHAR(200),
    "discount_active_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menu" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_profiles_user_id_key" ON "restaurant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_profiles_tax_number_key" ON "restaurant_profiles"("tax_number");

-- CreateIndex
CREATE INDEX "restaurant_profiles_place_id_idx" ON "restaurant_profiles"("place_id");

-- CreateIndex
CREATE INDEX "restaurant_profiles_status_idx" ON "restaurant_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "review_replies_review_id_key" ON "review_replies"("review_id");

-- AddForeignKey
ALTER TABLE "restaurant_profiles" ADD CONSTRAINT "restaurant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_menu" ADD CONSTRAINT "restaurant_menu_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
