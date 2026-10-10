-- Additive presentation fields; existing products retain their current theme.
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS border_color text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge_color text NOT NULL DEFAULT '';
ALTER TABLE products ADD CONSTRAINT products_border_color_valid CHECK (border_color = '' OR border_color ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE products ADD CONSTRAINT products_accent_color_valid CHECK (accent_color = '' OR accent_color ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE products ADD CONSTRAINT products_badge_color_valid CHECK (badge_color = '' OR badge_color ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS category_id text REFERENCES categories(id);
ALTER TABLE gift_codes ADD CONSTRAINT gift_target_exclusive CHECK (product_id IS NULL OR category_id IS NULL);
