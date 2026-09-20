-- Hafif ürün analitiği: mobil sink'in yazdığı funnel event tablosu (S14-M5 devamı).
-- Yeni tablo — mevcut veriye dokunmuyor, NOT VALID/kısmi doğrulama gerekmez.

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT,
  "name"       TEXT NOT NULL,
  "props"      JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- Funnel sorgusu: "bugün/bu hafta X olayı kaç kez oldu" — adına ve zamana göre.
CREATE INDEX IF NOT EXISTS "analytics_events_name_created_at_idx"
  ON "analytics_events" ("name", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx"
  ON "analytics_events" ("user_id");

-- onDelete: SetNull — kullanıcı hesabını sildiğinde (KVKK) event'in KENDİSİ değil,
-- kişisel bağlantısı kalkar; agregat huni istatistiği hesap silmeyle bozulmaz.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_user_id_fkey'
  ) THEN
    ALTER TABLE "analytics_events"
      ADD CONSTRAINT "analytics_events_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
