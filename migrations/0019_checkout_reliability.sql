-- Each order keeps the recipient and deadline displayed when it was created.
ALTER TABLE cart_request_payments ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE cart_request_payments ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE cart_request_payments ADD COLUMN IF NOT EXISTS receive_account text;
ALTER TABLE cart_request_payments ADD COLUMN IF NOT EXISTS receive_name text;
UPDATE cart_request_payments SET expires_at=created_at+interval '5 minutes' WHERE expires_at IS NULL;
UPDATE cart_request_payments p SET receive_account=s.receive_account,receive_name=s.receive_name
FROM shop_settings s WHERE s.id=1 AND p.receive_account IS NULL;
ALTER TABLE cart_request_payments ALTER COLUMN expires_at SET DEFAULT (now()+interval '5 minutes');
ALTER TABLE cart_request_payments ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE cart_request_payments DROP CONSTRAINT IF EXISTS cart_request_payments_status_check;
ALTER TABLE cart_request_payments ADD CONSTRAINT cart_request_payments_status_check
  CHECK(status IN ('unpaid','verifying','paid','rejected','manual_review','expired'));
-- Never lose evidence when a process ended during verification.
UPDATE cart_request_payments SET status='manual_review',reject_reason='รอแอดมินตรวจสอบหลักฐานการโอน'
WHERE status='verifying';
UPDATE cart_request_payments SET status='expired'
WHERE status IN ('unpaid','rejected') AND expires_at<=now();
CREATE INDEX IF NOT EXISTS cart_payment_deadlines ON cart_request_payments(expires_at)
  WHERE status IN ('unpaid','rejected');
