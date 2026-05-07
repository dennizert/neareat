-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_provider" TEXT NOT NULL DEFAULT 'google',
ADD COLUMN     "password_hash" TEXT,
ALTER COLUMN "google_id" DROP NOT NULL;
