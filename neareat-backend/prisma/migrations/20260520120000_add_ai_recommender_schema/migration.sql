-- AI Recommender Sprint-1 schema changes
-- Idempotent: tüm DDL'ler IF NOT EXISTS / DO blok guard'ları ile sarmalandı.
-- Bu sayede Railway deploy'unda migration accidentally tekrar çalışırsa hata vermez.

-- 1) User opt-in alanı: AI öneri motorunun arkadaş tercihlerini kullanmasına izin
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "share_with_friends_recommender" BOOLEAN NOT NULL DEFAULT false;

-- 2) AI öneri log tablosu (Claude API çağrılarının audit + rate-limit kaynağı)
CREATE TABLE IF NOT EXISTS "ai_recommendation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "candidate_place_ids" TEXT[],
    "suggested_place_ids" TEXT[],
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "mood" VARCHAR(50),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "response_json" JSONB,
    CONSTRAINT "ai_recommendation_logs_pkey" PRIMARY KEY ("id")
);

-- 3) FK: ai_recommendation_logs.user_id -> users.id (ON DELETE CASCADE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_recommendation_logs_user_id_fkey'
    ) THEN
        ALTER TABLE "ai_recommendation_logs"
            ADD CONSTRAINT "ai_recommendation_logs_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Index: kullanıcı için zaman sıralı sorgular (rate limit + history)
CREATE INDEX IF NOT EXISTS "ai_recommendation_logs_user_id_requested_at_idx"
    ON "ai_recommendation_logs"("user_id", "requested_at");
