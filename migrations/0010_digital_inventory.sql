-- Preserve legacy quantity products until the admin explicitly imports real items.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_mode text NOT NULL DEFAULT 'quantity'
  CHECK (stock_mode IN ('quantity','individual'));
CREATE TABLE IF NOT EXISTS inventory_items (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id),
  payload_ciphertext text NOT NULL,
  payload_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold','disabled')),
  order_id text UNIQUE REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  CHECK ((status IN ('available','disabled') AND order_id IS NULL) OR (status IN ('reserved','sold') AND order_id IS NOT NULL)),
  UNIQUE(product_id,payload_fingerprint)
);
CREATE INDEX IF NOT EXISTS inventory_available_product_idx
ON inventory_items(product_id,created_at,id) WHERE status='available';
