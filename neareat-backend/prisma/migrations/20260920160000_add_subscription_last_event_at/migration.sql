-- NEW-B01 — RTDN sıra/tazelik denetimi için "işlenmiş son olay" damgası. Idempotent.
--
-- Pub/Sub EN-AZ-BİR-KEZ teslim garantisi verir: tekrar teslim ve sırasız teslim
-- beklenen davranıştır. Bu damga olmadan aylar önce üretilmiş bir EXPIRED bildirimi
-- yeniden teslim edildiğinde, yenilenmiş ve ödenmiş bir abonelik sessizce düşüyordu.
--
-- NULLABLE ve backfill YOK: mevcut abonelikler için "henüz RTDN işlenmedi" demek
-- doğru olan. Sahte bir başlangıç değeri (ör. now()) yazmak, dağıtımdan hemen sonra
-- gelen MEŞRU bir yenileme bildirimini bayat sayıp bloklardı.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "last_event_at" TIMESTAMP(3);
