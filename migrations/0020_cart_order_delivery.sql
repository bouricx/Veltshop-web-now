-- Credentials are stored encrypted, separately from publicly shareable order details.
ALTER TABLE cart_requests ADD COLUMN delivery_ciphertext text;
ALTER TABLE cart_requests ADD COLUMN delivery_channel text CHECK(delivery_channel IN ('web','facebook','discord'));
ALTER TABLE cart_requests ADD COLUMN delivered_at timestamptz;
ALTER TABLE cart_requests ADD COLUMN delivered_by text;
CREATE UNIQUE INDEX bank_transfer_reference_once ON transactions(provider_ref)
  WHERE provider IN ('slip2go','manual_bank') AND provider_ref IS NOT NULL;
