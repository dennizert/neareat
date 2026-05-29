-- Anlık kampanya gönderimi rate limit alanı (S5-3)
ALTER TABLE "restaurant_profiles"
  ADD COLUMN IF NOT EXISTS "last_campaign_at" TIMESTAMP(3);
