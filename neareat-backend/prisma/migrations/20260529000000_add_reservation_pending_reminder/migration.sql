-- 24h+ PENDING rezervasyon escalation idempotency alanı (S5-1)
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "pending_reminder_sent_at" TIMESTAMP(3);
