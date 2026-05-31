-- Remove iyzico payment provider fields — replaced by Google Play / App Store IAP
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "iyzico_subscription_id";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "iyzico_payment_id";
