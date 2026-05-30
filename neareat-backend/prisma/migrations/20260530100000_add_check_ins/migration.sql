-- Sprint-7 #91 — kullanıcı check-in modeli (3 saat TTL)
CREATE TABLE IF NOT EXISTS "check_ins" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "place_id"   TEXT NOT NULL,
    "place_name" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "check_ins_user_id_expires_at_idx"
    ON "check_ins"("user_id", "expires_at");

CREATE INDEX IF NOT EXISTS "check_ins_expires_at_idx"
    ON "check_ins"("expires_at");

DO $$ BEGIN
    ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
