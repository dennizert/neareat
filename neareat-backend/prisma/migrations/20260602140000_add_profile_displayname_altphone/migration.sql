-- S10-1: restoran profili görünen ad + alternatif telefon (her ikisi de nullable)
ALTER TABLE "restaurant_profiles" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "restaurant_profiles" ADD COLUMN IF NOT EXISTS "alt_phone" TEXT;
