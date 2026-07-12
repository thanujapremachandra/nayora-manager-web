-- ============================================================
-- Nayora Clothing — initial schema
-- Run this in your Supabase SQL editor or via supabase db push
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Settings (singleton) ────────────────────────────────────
CREATE TABLE settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_name text NOT NULL DEFAULT 'Nayora Clothing',
  address text NOT NULL DEFAULT 'No 16, Kumudu Mawatha, Primrose Gardens, Kandy',
  phone1 text NOT NULL DEFAULT '0774774670',
  phone2 text DEFAULT '0777898768',
  slip_footer_text text NOT NULL DEFAULT 'Nayora Clothing — No 16, Kumudu Mawatha, Primrose Gardens, Kandy — 0774774670 / 0777898768',
  default_low_stock_threshold int NOT NULL DEFAULT 5,
  -- [CONFIRM WITH USER] Courier weight tier cutoff (grams) and charges.
  -- Currently set to placeholder zeroes. Edit in Settings → Courier Tiers.
  courier_tiers jsonb NOT NULL DEFAULT '[{"max_grams": 1000, "charge": 0}, {"max_grams": null, "charge": 0}]',
  currency text NOT NULL DEFAULT 'LKR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Products ────────────────────────────────────────────────
CREATE TABLE products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  price_mode text NOT NULL DEFAULT 'global' CHECK (price_mode IN ('global', 'variant')),
  global_price numeric(12, 2),
  global_cost numeric(12, 2),
  low_stock_threshold int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Product attributes (e.g. "Colour", "Size") ──────────────
CREATE TABLE product_attributes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── Attribute values (e.g. "Blue", "XL") ────────────────────
CREATE TABLE attribute_values (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  attribute_id uuid NOT NULL REFERENCES product_attributes (id) ON DELETE CASCADE,
  value text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── Variants (one combination of attribute values) ──────────
CREATE TABLE variants (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name text,
  image_url text,
  on_hand int NOT NULL DEFAULT 0,
  reserved int NOT NULL DEFAULT 0,
  price numeric(12, 2),
  cost numeric(12, 2),
  created_at timestamptz DEFAULT now()
);

-- ─── Variant ↔ attribute value mapping ───────────────────────
CREATE TABLE variant_attribute_values (
  variant_id uuid NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  attribute_value_id uuid NOT NULL REFERENCES attribute_values (id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, attribute_value_id)
);

-- ─── Sessions (daily dispatch batches) ───────────────────────
CREATE TABLE sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ─── Order ref sequence ───────────────────────────────────────
CREATE SEQUENCE order_ref_seq START 1;

-- ─── Orders ──────────────────────────────────────────────────
CREATE TABLE orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ref_id text NOT NULL UNIQUE DEFAULT ('NYR-' || LPAD(nextval('order_ref_seq')::text, 4, '0')),
  session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  address text NOT NULL,
  phone1 text NOT NULL,
  phone2 text,
  payment_type text NOT NULL DEFAULT 'cod' CHECK (payment_type IN ('cod', 'bank')),
  order_discount numeric(12, 2),
  weight_grams int,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'frozen', 'issue', 'sent', 'returned', 'cancelled')),
  freeze_stock_mode text CHECK (freeze_stock_mode IN ('reserved', 'released')),
  remarks text,
  cod_amount_override numeric(12, 2),
  courier_charge_override numeric(12, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Stock adjustments (append-only audit log) ───────────────
CREATE TABLE stock_adjustments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  delta int NOT NULL,
  reason text NOT NULL CHECK (reason IN ('restock', 'damage', 'correction', 'reserve', 'release', 'sold', 'restore')),
  note text,
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── Order items ─────────────────────────────────────────────
CREATE TABLE order_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES variants (id) ON DELETE RESTRICT,
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price numeric(12, 2) NOT NULL,
  line_discount numeric(12, 2),
  created_at timestamptz DEFAULT now()
);

-- ─── Order tracking numbers ───────────────────────────────────
CREATE TABLE order_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── Dismissed alerts ────────────────────────────────────────
CREATE TABLE dismissed_alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_key text NOT NULL UNIQUE,
  dismissed_at timestamptz DEFAULT now()
);

-- ─── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-level security ───────────────────────────────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_alerts ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access; anon gets nothing (default deny).
CREATE POLICY "authenticated_full" ON settings       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON products       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON product_attributes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON attribute_values   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON variants       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON variant_attribute_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON stock_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON sessions       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON orders         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON order_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON order_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON dismissed_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Storage bucket for variant images ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('variant-images', 'variant-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'variant-images');

CREATE POLICY "authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'variant-images');

CREATE POLICY "authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'variant-images');

CREATE POLICY "public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'variant-images');

-- ─── Seed default settings row ───────────────────────────────
INSERT INTO settings (
  business_name, address, phone1, phone2,
  slip_footer_text, default_low_stock_threshold,
  courier_tiers, currency
) VALUES (
  'Nayora Clothing',
  'No 16, Kumudu Mawatha, Primrose Gardens, Kandy',
  '0774774670',
  '0777898768',
  'Nayora Clothing — No 16, Kumudu Mawatha, Primrose Gardens, Kandy — 0774774670 / 0777898768',
  5,
  '[{"max_grams": 1000, "charge": 0}, {"max_grams": null, "charge": 0}]',
  'LKR'
);
