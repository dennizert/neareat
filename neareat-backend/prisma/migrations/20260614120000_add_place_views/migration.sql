-- Sprint-17 #366: "Son baktigin restoranlar" goruntuleme kaydi (PlaceView).
CREATE TABLE IF NOT EXISTS "place_views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "place_name" TEXT NOT NULL,
    "place_address" VARCHAR(300),
    "place_photo_url" TEXT,
    "place_rating" DECIMAL(3,1),
    "place_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "place_views_user_id_place_id_key" ON "place_views" ("user_id", "place_id");
CREATE INDEX IF NOT EXISTS "place_views_user_id_viewed_at_idx" ON "place_views" ("user_id", "viewed_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'place_views_user_id_fkey'
  ) THEN
    ALTER TABLE "place_views"
      ADD CONSTRAINT "place_views_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
