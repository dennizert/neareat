-- Sprint-7 #93 — kişisel yemek günlüğü (kullanıcı özel, ziyaret kayıtları)
CREATE TABLE IF NOT EXISTS "diary_entries" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "place_id"        TEXT NOT NULL,
    "place_name"      TEXT NOT NULL,
    "place_photo_url" TEXT,
    "place_types"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "visited_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"            VARCHAR(500),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "diary_entries_user_id_visited_at_idx"
    ON "diary_entries"("user_id", "visited_at");

DO $$ BEGIN
    ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
