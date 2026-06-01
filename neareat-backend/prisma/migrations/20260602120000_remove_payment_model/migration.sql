-- Remove unused Payment model (dead code after iyzico removal; never referenced in app)
DROP TABLE IF EXISTS "payments";
DROP TYPE IF EXISTS "PaymentStatus";
