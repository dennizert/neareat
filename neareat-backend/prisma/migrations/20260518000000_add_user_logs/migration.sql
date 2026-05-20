CREATE TABLE IF NOT EXISTS "user_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT,
    "email" TEXT,
    "page" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" VARCHAR(500),
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_logs_user_id_idx" ON "user_logs"("user_id");
CREATE INDEX IF NOT EXISTS "user_logs_email_idx" ON "user_logs"("email");
CREATE INDEX IF NOT EXISTS "user_logs_created_at_idx" ON "user_logs"("created_at");

DO $$ BEGIN
    ALTER TABLE "user_logs" ADD CONSTRAINT "user_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
