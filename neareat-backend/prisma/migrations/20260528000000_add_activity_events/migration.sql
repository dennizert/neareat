CREATE TABLE IF NOT EXISTS "activity_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "place_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activity_events_user_id_created_at_idx" ON "activity_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "activity_events_created_at_idx" ON "activity_events"("created_at");

DO $$ BEGIN
    ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
