CREATE TABLE cart_request_payments (
  cart_request_id text PRIMARY KEY REFERENCES cart_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','verifying','paid','rejected','manual_review')),
  slip_hash text UNIQUE,
  provider_reference text,
  slip_evidence text,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
INSERT INTO cart_request_payments(cart_request_id,user_id,amount)
  SELECT id,user_id,total FROM cart_requests WHERE total > 0
  ON CONFLICT(cart_request_id) DO NOTHING;
CREATE INDEX cart_request_payments_user_date ON cart_request_payments(user_id,created_at DESC);
CREATE UNIQUE INDEX cart_request_payments_provider_reference_idx
  ON cart_request_payments(provider_reference) WHERE provider_reference IS NOT NULL;
