-- RecommendationFeedback'e mutfak tipi alanı (S4-7)
ALTER TABLE "recommendation_feedback"
  ADD COLUMN IF NOT EXISTS "place_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Kullanıcı bazlı tercih özeti tablosu
CREATE TABLE IF NOT EXISTS "feedback_preferences" (
    "user_id" TEXT NOT NULL,
    "liked_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "disliked_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_preferences_pkey" PRIMARY KEY ("user_id")
);

DO $$ BEGIN
    ALTER TABLE "feedback_preferences" ADD CONSTRAINT "feedback_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
