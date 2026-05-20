-- ─────────────────────────────────────────────────────────────────────────────
-- HOTFIX (Sprint-2 retro #1): Bu migration daha önce bozuktu — `messages`
-- tablosuna `reporter_id`/`reported_id` FK'leri ekliyordu ama bu kolonlar
-- `messages` tablosunda yok (sender_id/receiver_id var). user_reports'a ait
-- FK'ler yanlışlıkla `messages` tablosuna eklenmiş, P3018 ile fail ediyordu.
--
-- Düzeltme: yanlış FK'ler kaldırıldı. Tüm DDL idempotent (IF NOT EXISTS / DO blok)
-- yapıldı ki hem fresh DB'de hem mevcut DB'de güvenli re-run olsun.
--
-- Bu sayede: `ensure_messages_reports` (20260512000000) artık bağımsız değil
-- — aynı tabloları ekler ama çakışmaz. package.json start script'inden
-- `migrate resolve --applied 20260511120000_add_messages_and_reports`
-- workaround'ı kaldırıldı.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable: FriendRequest add note field
ALTER TABLE "friend_requests" ADD COLUMN IF NOT EXISTS "note" VARCHAR(300);

-- CreateTable: messages
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_reports
CREATE TABLE IF NOT EXISTS "user_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reported_id" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "action_taken" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "messages_sender_id_receiver_id_idx" ON "messages"("sender_id", "receiver_id");
CREATE INDEX IF NOT EXISTS "messages_receiver_id_is_read_idx" ON "messages"("receiver_id", "is_read");
CREATE INDEX IF NOT EXISTS "user_reports_reported_id_status_idx" ON "user_reports"("reported_id", "status");
CREATE INDEX IF NOT EXISTS "user_reports_reporter_id_idx" ON "user_reports"("reporter_id");

-- AddForeignKey: messages (idempotent — DO bloklarıyla)
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey"
    FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: user_reports (idempotent)
DO $$ BEGIN
  ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_fkey"
    FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
