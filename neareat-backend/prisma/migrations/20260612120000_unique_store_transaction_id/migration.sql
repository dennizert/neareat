-- S12-3: purchaseToken yeniden kullanımını engelle.
-- store_transaction_id artık benzersiz — aynı satın alma token'ı yalnızca tek bir
-- aboneliğe (tek hesaba) bağlanabilir. Sütun nullable olduğundan trial/null satırlar
-- etkilenmez (Postgres unique index birden çok NULL'a izin verir).
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_store_transaction_id_key"
  ON "subscriptions" ("store_transaction_id");
