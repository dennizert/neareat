-- S18-4: sezonluk yildiz sifirlamasi capasi (User.seasonStartAt).
-- 6 ayda bir sezon kapanir; bu damga en son sezon baslangicini tutar.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "season_start_at" TIMESTAMP(3);
