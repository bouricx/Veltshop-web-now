CREATE TABLE cart_requests (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id),
 idempotency_key text NOT NULL,
 fingerprint text NOT NULL,
 contact text NOT NULL CHECK (length(contact) BETWEEN 3 AND 300),
 note text NOT NULL DEFAULT '' CHECK (length(note)<=2000),
 items jsonb NOT NULL CHECK (jsonb_typeof(items)='array'),
 total integer NOT NULL CHECK (total>=0),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','done','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX cart_requests_status_date ON cart_requests(status,created_at DESC);
CREATE INDEX cart_requests_user_date ON cart_requests(user_id,created_at DESC);
CREATE FUNCTION record_cart_request_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('veltshop.restoring',true) IS DISTINCT FROM '1' THEN
  INSERT INTO admin_events(kind,entity_id) VALUES('cart.requested',NEW.id);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER cart_request_event AFTER INSERT ON cart_requests FOR EACH ROW EXECUTE FUNCTION record_cart_request_event();
