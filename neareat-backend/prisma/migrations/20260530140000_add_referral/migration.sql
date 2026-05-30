-- referral_code + referral_applied columns on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code    TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- REFERRAL value on StarEventType enum (idempotent)
DO $$ BEGIN
  ALTER TYPE "StarEventType" ADD VALUE IF NOT EXISTS 'REFERRAL';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
