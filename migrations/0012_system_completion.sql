-- Additive operational features; existing financial records are retained.
CREATE TABLE private_files (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id),
 inventory_id text NOT NULL UNIQUE REFERENCES inventory_items(id),
 name text NOT NULL, mime text NOT NULL, size int NOT NULL CHECK(size BETWEEN 1 AND 2097152),
 content_hash text NOT NULL, ciphertext text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE privacy_requests (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL CHECK(kind IN ('deletion')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reason text NOT NULL DEFAULT '', reply text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text
);
CREATE UNIQUE INDEX privacy_pending_user ON privacy_requests(user_id,kind) WHERE status='pending';
CREATE TABLE system_runs (
 id text PRIMARY KEY, kind text NOT NULL, status text NOT NULL CHECK(status IN ('running','success','failed')),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 result jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX system_runs_recent ON system_runs(started_at DESC);
-- Commit-bound invalidation counters; events never expose order/customer payloads.
CREATE TABLE realtime_revisions (id bigserial PRIMARY KEY, scope text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX realtime_scope_idx ON realtime_revisions(scope,id);
CREATE FUNCTION bump_shop_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text;
BEGIN
 IF TG_ARGV[0]='public' THEN
  INSERT INTO realtime_revisions(scope) VALUES('public');
 ELSE
  owner_id := COALESCE(to_jsonb(NEW)->>TG_ARGV[1],to_jsonb(OLD)->>TG_ARGV[1]);
  IF owner_id IS NOT NULL THEN
   INSERT INTO realtime_revisions(scope) VALUES('user:'||owner_id);
  END IF;
 END IF;
 INSERT INTO realtime_revisions(scope) VALUES('admin');
 RETURN NULL;
END $$;
CREATE TRIGGER revision_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('public');
CREATE TRIGGER revision_categories AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('public');
CREATE TRIGGER revision_content AFTER INSERT OR UPDATE OR DELETE ON content_blocks FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('public');
CREATE TRIGGER revision_configuration AFTER UPDATE ON site_configuration FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('public');
CREATE TRIGGER revision_wallet AFTER INSERT OR UPDATE ON wallet_accounts FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','user_id');
CREATE TRIGGER revision_orders AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','user_id');
CREATE TRIGGER revision_payments AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','user_id');
CREATE TRIGGER revision_claims AFTER INSERT OR UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','user_id');
CREATE TRIGGER revision_notifications AFTER INSERT OR UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','user_id');
CREATE TRIGGER revision_users AFTER INSERT OR UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('private','id');
