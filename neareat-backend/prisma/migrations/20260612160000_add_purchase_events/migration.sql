-- S14-B4: IAP purchase ledger (append-only denetim defteri).
CREATE TABLE IF NOT EXISTS "purchase_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "product_id" TEXT,
    "token_hash" TEXT,
    "status" TEXT NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "purchase_events_user_id_idx" ON "purchase_events" ("user_id");
CREATE INDEX IF NOT EXISTS "purchase_events_token_hash_idx" ON "purchase_events" ("token_hash");
