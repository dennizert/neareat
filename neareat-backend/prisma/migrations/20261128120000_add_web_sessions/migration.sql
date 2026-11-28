-- Web paneli çerez oturumu (ADR-001 #4, §5; issue #524).
-- Yeni tablo — mevcut veriye dokunmuyor. Idempotent: IF NOT EXISTS + koşullu FK, böylece
-- `npm start` (prisma/deploy.js) yarıda kalmış bir uygulamayı tekrar çalıştırsa da kırılmaz.

CREATE TABLE IF NOT EXISTS "web_sessions" (
  "id"                  TEXT NOT NULL,
  "user_id"             TEXT NOT NULL,
  "csrf_secret"         TEXT NOT NULL,
  "idle_expires_at"     TIMESTAMP(3) NOT NULL,
  "absolute_expires_at" TIMESTAMP(3) NOT NULL,
  "mfa_verified_at"     TIMESTAMP(3),
  "revoked_at"          TIMESTAMP(3),
  "last_seen_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "web_sessions_pkey" PRIMARY KEY ("id")
);

-- "Kullanıcının bütün oturumlarını iptal et" (logout-all, şifre sıfırlama, askıya alma).
CREATE INDEX IF NOT EXISTS "web_sessions_user_id_idx" ON "web_sessions" ("user_id");

-- Süresi dolmuş satırların ileride toplu temizliği için.
CREATE INDEX IF NOT EXISTS "web_sessions_absolute_expires_at_idx" ON "web_sessions" ("absolute_expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'web_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE "web_sessions"
      ADD CONSTRAINT "web_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
