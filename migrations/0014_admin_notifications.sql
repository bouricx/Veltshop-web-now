-- Commit-bound notifications, without payment proofs, credentials or customer PII.
CREATE TABLE admin_events (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 kind text NOT NULL, entity_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_events_recent ON admin_events(created_at DESC,id);
CREATE TABLE admin_event_reads (
 event_id text NOT NULL REFERENCES admin_events(id),
 user_id text NOT NULL REFERENCES "user"(id),
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id)
);
CREATE FUNCTION record_admin_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE threshold int; vip int; vvip int; spent bigint; before_spent bigint;
BEGIN
 IF current_setting('veltshop.restoring',true)='1' THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='user' THEN
  INSERT INTO admin_events(kind,entity_id) VALUES('user.created',NEW.id);
 ELSIF TG_TABLE_NAME='orders' THEN
  IF TG_OP='INSERT' THEN INSERT INTO admin_events(kind,entity_id) VALUES('order.created',NEW.id); END IF;
  IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   INSERT INTO admin_events(kind,entity_id) VALUES('order.completed',NEW.id);
   SELECT COALESCE((value->>'vip')::int,500),COALESCE((value->>'vvip')::int,2000) INTO vip,vvip FROM site_configuration WHERE id=1;
   SELECT COALESCE(sum(total),0) INTO spent FROM orders WHERE user_id=NEW.user_id AND status='completed';
   before_spent := spent - NEW.total;
   IF spent>=vip AND before_spent<vip THEN INSERT INTO admin_events(kind,entity_id) VALUES('member.vip',NEW.user_id); END IF;
   IF spent>=vvip AND before_spent<vvip THEN INSERT INTO admin_events(kind,entity_id) VALUES('member.vvip',NEW.user_id); END IF;
  END IF;
 ELSIF TG_TABLE_NAME='payments' THEN
  IF TG_OP='INSERT' THEN INSERT INTO admin_events(kind,entity_id) VALUES('topup.created',NEW.id); END IF;
  IF NEW.status IN ('rejected','reconciliation_required') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   INSERT INTO admin_events(kind,entity_id) VALUES('payment.failed',NEW.id);
  END IF;
 ELSIF TG_TABLE_NAME='products' THEN
  SELECT COALESCE((value->>'lowStock')::int,5) INTO threshold FROM site_configuration WHERE id=1;
  IF NEW.active AND NEW.stock<=threshold AND (TG_OP='INSERT' OR OLD.stock>threshold OR NOT OLD.active) THEN
   INSERT INTO admin_events(kind,entity_id) VALUES('stock.low',NEW.id);
  END IF;
 ELSIF TG_TABLE_NAME='jobs' THEN
  IF NEW.status IN ('failed','dead_letter') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   INSERT INTO admin_events(kind,entity_id) VALUES('job.failed',NEW.id);
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER notify_admin_user AFTER INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION record_admin_event();
CREATE TRIGGER notify_admin_order AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION record_admin_event();
CREATE TRIGGER notify_admin_payment AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION record_admin_event();
CREATE TRIGGER notify_admin_stock AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION record_admin_event();
CREATE TRIGGER notify_admin_job AFTER INSERT OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION record_admin_event();
CREATE TRIGGER revision_admin_events AFTER INSERT ON admin_events FOR EACH ROW EXECUTE FUNCTION bump_shop_revision('admin');
