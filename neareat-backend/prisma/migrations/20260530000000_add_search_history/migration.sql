-- Sprint-6 #87 — kullanıcı arama geçmişi
CREATE TABLE IF NOT EXISTS "search_history" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "query"      VARCHAR(200) NOT NULL,
    "type"       VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "search_history_user_id_created_at_idx"
    ON "search_history"("user_id", "created_at");

DO $$ BEGIN
    ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
