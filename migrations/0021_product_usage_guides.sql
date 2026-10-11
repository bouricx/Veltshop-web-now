CREATE TABLE IF NOT EXISTS product_usage_guides (
  product_id text PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  instructions text NOT NULL CHECK (length(btrim(instructions)) BETWEEN 1 AND 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
