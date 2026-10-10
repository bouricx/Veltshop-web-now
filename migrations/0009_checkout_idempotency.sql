-- Additive; existing orders remain intact. Never backfill browser balances.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_idempotency_idx
ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_payment_once_idx
ON wallet_ledger(payment_id) WHERE payment_id IS NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_once_idx
ON payments(provider, provider_reference) WHERE status='success' AND provider_reference IS NOT NULL;
