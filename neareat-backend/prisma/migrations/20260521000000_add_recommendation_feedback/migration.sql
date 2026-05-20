-- Migration: 20260521000000_add_recommendation_feedback
-- Sprint-2 Task #4: RecommendationFeedback tablosu (👍/👎)
-- Idempotent — IF NOT EXISTS guards; Railway production'da güvenle uygulanır.

CREATE TABLE IF NOT EXISTS "recommendation_feedback" (
  "id"                       TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"                  TEXT         NOT NULL,
  "ai_recommendation_log_id" TEXT,
  "place_id"                 TEXT         NOT NULL,
  "sentiment"                TEXT         NOT NULL,
  "comment"                  VARCHAR(500),
  "visited"                  BOOLEAN      NOT NULL DEFAULT false,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- FK: user_id → users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recommendation_feedback_user_id_fkey'
      AND table_name = 'recommendation_feedback'
  ) THEN
    ALTER TABLE "recommendation_feedback"
      ADD CONSTRAINT "recommendation_feedback_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END;
$$;

-- FK: ai_recommendation_log_id → ai_recommendation_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recommendation_feedback_ai_recommendation_log_id_fkey'
      AND table_name = 'recommendation_feedback'
  ) THEN
    ALTER TABLE "recommendation_feedback"
      ADD CONSTRAINT "recommendation_feedback_ai_recommendation_log_id_fkey"
      FOREIGN KEY ("ai_recommendation_log_id") REFERENCES "ai_recommendation_logs"("id") ON DELETE SET NULL;
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "recommendation_feedback_user_id_created_at_idx"
  ON "recommendation_feedback"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "recommendation_feedback_ai_recommendation_log_id_idx"
  ON "recommendation_feedback"("ai_recommendation_log_id");

CREATE INDEX IF NOT EXISTS "recommendation_feedback_place_id_sentiment_idx"
  ON "recommendation_feedback"("place_id", "sentiment");
