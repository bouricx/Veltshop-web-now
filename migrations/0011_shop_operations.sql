-- Additive operational data. Existing money, identities and sales are preserved.
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_days int NOT NULL DEFAULT 0 CHECK(warranty_days BETWEEN 0 AND 3650);
ALTER TABLE products ADD COLUMN IF NOT EXISTS card_color text NOT NULL DEFAULT '#18181b';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warranty_end timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_input text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id text;
CREATE TABLE IF NOT EXISTS order_deliveries (
 id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), product_id text NOT NULL REFERENCES products(id),
 payload_ciphertext text NOT NULL, actor_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_order_idx ON order_deliveries(order_id,created_at DESC);
CREATE TABLE IF NOT EXISTS operation_keys (
 user_id text NOT NULL, key text NOT NULL, kind text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS claims (
 id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id), user_id text NOT NULL,
 title text NOT NULL, message text NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','accepted','rejected','replaced','refunded','closed')),
 reply text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS active_claim_order_idx ON claims(order_id) WHERE status IN ('pending','accepted');
CREATE INDEX IF NOT EXISTS claims_user_idx ON claims(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS member_profiles (
 user_id text PRIMARY KEY, rank text NOT NULL DEFAULT 'New Member', rank_color text NOT NULL DEFAULT '#64748b',
 disabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gift_codes (
 id text PRIMARY KEY, code_hash text NOT NULL UNIQUE, label text NOT NULL, reward text NOT NULL CHECK(reward IN ('credit','product')),
 amount int NOT NULL DEFAULT 0 CHECK(amount>=0), product_id text REFERENCES products(id),
 active boolean NOT NULL DEFAULT true, expires_at timestamptz, usage_limit int NOT NULL CHECK(usage_limit>0),
 used int NOT NULL DEFAULT 0 CHECK(used>=0 AND used<=usage_limit), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gift_redemptions (
 id text PRIMARY KEY, gift_id text NOT NULL REFERENCES gift_codes(id), user_id text NOT NULL,
 order_id text REFERENCES orders(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(gift_id,user_id)
);
CREATE TABLE IF NOT EXISTS coupons (
 id text PRIMARY KEY, code text NOT NULL UNIQUE, kind text NOT NULL CHECK(kind IN ('fixed','percent')),
 amount int NOT NULL CHECK(amount>0), minimum int NOT NULL DEFAULT 0 CHECK(minimum>=0),
 product_id text REFERENCES products(id), category_id text REFERENCES categories(id), active boolean NOT NULL DEFAULT true,
 expires_at timestamptz, usage_limit int NOT NULL CHECK(usage_limit>0), per_user_limit int NOT NULL DEFAULT 1 CHECK(per_user_limit>0),
 used int NOT NULL DEFAULT 0 CHECK(used>=0 AND used<=usage_limit)
);
CREATE TABLE IF NOT EXISTS coupon_uses (
 coupon_id text NOT NULL REFERENCES coupons(id), order_id text NOT NULL UNIQUE REFERENCES orders(id), user_id text NOT NULL,
 PRIMARY KEY(coupon_id,order_id)
);
CREATE TABLE IF NOT EXISTS content_blocks (
 id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('banner','announcement')), title text NOT NULL,
 body text NOT NULL DEFAULT '', image text NOT NULL DEFAULT '', link text NOT NULL DEFAULT '',
 audience text NOT NULL DEFAULT 'all' CHECK(audience IN ('all','members')), priority int NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_configuration (id int PRIMARY KEY CHECK(id=1), value jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO site_configuration(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS notifications (
 id text PRIMARY KEY, user_id text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '',
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_user_idx ON notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS request_limits (
 key text PRIMARY KEY, hits int NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
 id text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','success','failed','retry','dead_letter')),
 attempts int NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 lease_token text, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_ready_idx ON jobs(status,available_at);
CREATE TABLE IF NOT EXISTS media_assets (
 id text PRIMARY KEY, kind text NOT NULL, mime text NOT NULL, width int NOT NULL, height int NOT NULL,
 bytes bytea NOT NULL, thumbnail bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS backup_records (
 id text PRIMARY KEY, status text NOT NULL, checksum text, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "rateLimit" (
 "id" text PRIMARY KEY, "key" text NOT NULL UNIQUE, "count" int NOT NULL, "lastRequest" bigint NOT NULL
);
INSERT INTO permissions(id,name) VALUES('dashboard.read','dashboard.read'),('media.manage','media.manage'),('promotions.manage','promotions.manage') ON CONFLICT DO NOTHING;
-- Correct the inherited admin role which unintentionally included super-admin powers.
DELETE FROM role_permissions WHERE role_id='admin' AND permission_id IN ('roles.manage','system.manage','roles.read');
INSERT INTO role_permissions(role_id,permission_id) SELECT 'super_admin',id FROM permissions ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT 'admin',id FROM permissions WHERE id IN ('dashboard.read','media.manage','promotions.manage','audit.read','wallet.manage','catalog.manage') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT 'staff',id FROM permissions WHERE id='dashboard.read' ON CONFLICT DO NOTHING;
-- Protect historical financial and audit records against ordinary application updates/deletes.
CREATE OR REPLACE FUNCTION reject_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable record'; END $$;
DROP TRIGGER IF EXISTS immutable_wallet_ledger ON wallet_ledger;
CREATE TRIGGER immutable_wallet_ledger BEFORE UPDATE OR DELETE ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
DROP TRIGGER IF EXISTS immutable_audit_logs ON audit_logs;
CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
CREATE TABLE IF NOT EXISTS payment_verifications (
 payment_id text PRIMARY KEY REFERENCES payments(id),user_id text NOT NULL,amount int NOT NULL,fee int NOT NULL,
 credit int NOT NULL,hash text NOT NULL,reference text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_payment_verifications BEFORE UPDATE OR DELETE ON payment_verifications FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
ALTER TABLE backup_records ADD COLUMN IF NOT EXISTS bytes bytea;
CREATE TRIGGER immutable_transactions BEFORE UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
CREATE TRIGGER preserve_orders BEFORE DELETE ON orders FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
CREATE TRIGGER preserve_payments BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION reject_record_mutation();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gift_ciphertext text;
CREATE TABLE IF NOT EXISTS transfer_references(reference text PRIMARY KEY,payment_id text NOT NULL UNIQUE REFERENCES payments(id));
INSERT INTO transfer_references(reference,payment_id) SELECT provider_reference,min(id) FROM payments WHERE status='success' AND provider_reference IS NOT NULL GROUP BY provider_reference ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS reward_campaigns (
 id text PRIMARY KEY CHECK(id IN ('wheel','box')),title text NOT NULL,cost int NOT NULL DEFAULT 0 CHECK(cost>=0),
 daily_limit int NOT NULL DEFAULT 2 CHECK(daily_limit BETWEEN 1 AND 100),active boolean NOT NULL DEFAULT false,prizes jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS reward_plays (
 id text PRIMARY KEY,campaign_id text NOT NULL REFERENCES reward_campaigns(id),user_id text NOT NULL,key text NOT NULL,
 prize_index int NOT NULL,cost int NOT NULL,reward int NOT NULL,balance int NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,key)
);
CREATE INDEX IF NOT EXISTS reward_plays_day_idx ON reward_plays(user_id,campaign_id,created_at);

CREATE TABLE IF NOT EXISTS login_history (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id), event text NOT NULL CHECK(event IN ('auth.login','auth.logout')),
 ip_address text, user_agent text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_history_user_date ON login_history(user_id,created_at DESC);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#18181b' CHECK(color ~ '^#[a-fA-F0-9]{6}$');

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
