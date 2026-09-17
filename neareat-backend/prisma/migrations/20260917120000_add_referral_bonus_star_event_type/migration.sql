-- REFERRAL_BONUS value on StarEventType enum (idempotent).
-- stars.js STAR_AMOUNTS.REFERRAL_BONUS ve referralController davet edilen kullanıcıya
-- bu tipi yazıyordu; enum'da karşılığı olmadığı için `POST /api/referral/apply`
-- çağrısı Prisma hatasıyla düşüyordu.
DO $$ BEGIN
  ALTER TYPE "StarEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
