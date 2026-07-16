-- ============================================================
-- RESET 2 of 3  —  REBUILD THE FULL SCHEMA
-- ============================================================
-- The complete, current schema — every migration 001 → 017
-- consolidated into one clean file (final column state only,
-- none of the add-then-drop churn). Running this on the empty
-- schema left by RESET_1 fully recreates the database.
--
-- If you prefer, running migrations 001…017 in order produces
-- the exact same result; this is just the single-file version.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Settings (singleton) ────────────────────────────────────
CREATE TABLE settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_name text NOT NULL DEFAULT 'Nayora Clothing',
  address text NOT NULL DEFAULT 'No 16, Kumudu Mawatha, Primrose Gardens, Kandy',
  phone1 text NOT NULL DEFAULT '0774774670',
  phone2 text DEFAULT '0777898768',
  slip_footer_text text NOT NULL DEFAULT 'Nayora Clothing — No 16, Kumudu Mawatha, Primrose Gardens, Kandy — 0774774670 / 0777898768',
  default_low_stock_threshold int NOT NULL DEFAULT 5,
  default_courier_charge numeric(12, 2) NOT NULL DEFAULT 450,
  currency text NOT NULL DEFAULT 'LKR',
  slip_template jsonb,
  slip_placement_layout jsonb,
  default_order_entry_mode text NOT NULL DEFAULT 'stock' CHECK (default_order_entry_mode IN ('stock', 'text')),
  exchange_keep_courier_charge boolean NOT NULL DEFAULT false,
  bank_transfer_collect boolean NOT NULL DEFAULT false,
  auto_weight_enabled boolean NOT NULL DEFAULT true,
  auto_weight_mode text NOT NULL DEFAULT 'count' CHECK (auto_weight_mode IN ('count', 'price')),
  auto_weight_threshold numeric(12, 2) NOT NULL DEFAULT 3,
  auto_weight_over_grams int NOT NULL DEFAULT 1000,
  auto_weight_under_grams int NOT NULL DEFAULT 800,
  brand_color text,
  card_color_light text,
  card_color_dark text,
  bg_color_light text,
  bg_color_dark text,
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

CREATE TABLE product_attributes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE attribute_values (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  attribute_id uuid NOT NULL REFERENCES product_attributes (id) ON DELETE CASCADE,
  value text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE variant_attribute_values (
  variant_id uuid NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  attribute_value_id uuid NOT NULL REFERENCES attribute_values (id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, attribute_value_id)
);

-- Product-level image gallery (bulk-uploaded pool variants pick from).
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Sessions (daily dispatch batches) ───────────────────────
CREATE TABLE sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ─── Order ref sequence ──────────────────────────────────────
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
  is_exchange boolean NOT NULL DEFAULT false,
  dispatched_via_session_complete_at timestamptz,
  package_description text,
  items_text text,
  items_amount numeric(12, 2),
  legacy_mode boolean NOT NULL DEFAULT false,
  exchange_keep_courier_override boolean,
  bank_collect_override boolean,
  auto_weight_override boolean,
  exchange_source_order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
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
  product_name_snapshot text,
  variant_label_snapshot text,
  created_at timestamptz DEFAULT now()
);

-- ─── Order tracking numbers ──────────────────────────────────
CREATE TABLE order_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ─── Tracking number pool (bulk-uploaded, auto-assigned FIFO) ─
CREATE TABLE tracking_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text NOT NULL,
  order_id uuid REFERENCES orders (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_pool_number_unique UNIQUE (tracking_number)
);

-- ─── Dismissed alerts ────────────────────────────────────────
CREATE TABLE dismissed_alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_key text NOT NULL UNIQUE,
  dismissed_at timestamptz DEFAULT now()
);

-- ─── Courier Excel export columns (Settings → Excel Export) ───
CREATE TABLE export_columns (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  position int NOT NULL,
  header_label text NOT NULL,
  source text NOT NULL CHECK (source IN (
    'tracking_numbers', 'ref_id', 'package_description', 'receiver_name',
    'receiver_address', 'receiver_city', 'receiver_contact', 'kilo', 'gram',
    'amount', 'exchange', 'remark', 'fixed'
  )),
  fallback_value text,
  true_value text,
  false_value text,
  created_at timestamptz DEFAULT now()
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

-- ─── Indexes ─────────────────────────────────────────────────
-- Trigram GIN indexes for ilike '%substring%' search at scale.
CREATE INDEX idx_orders_ref_id_trgm         ON orders USING gin (ref_id gin_trgm_ops);
CREATE INDEX idx_orders_customer_name_trgm  ON orders USING gin (customer_name gin_trgm_ops);
CREATE INDEX idx_orders_phone1_trgm         ON orders USING gin (phone1 gin_trgm_ops);
CREATE INDEX idx_orders_phone2_trgm         ON orders USING gin (phone2 gin_trgm_ops);
CREATE INDEX idx_order_tracking_number_trgm ON order_tracking USING gin (tracking_number gin_trgm_ops);
CREATE INDEX idx_products_name_trgm         ON products USING gin (name gin_trgm_ops);

-- Plain btree indexes for exact-match lookups and joins.
CREATE INDEX idx_orders_session_id          ON orders (session_id);
CREATE INDEX idx_orders_status              ON orders (status);
CREATE INDEX idx_order_items_order_id       ON order_items (order_id);
CREATE INDEX idx_order_items_variant_id     ON order_items (variant_id);
CREATE INDEX idx_order_tracking_order_id    ON order_tracking (order_id);
CREATE INDEX idx_order_tracking_number      ON order_tracking (tracking_number);
CREATE INDEX idx_variants_product_id        ON variants (product_id);
CREATE INDEX idx_stock_adjustments_variant_id ON stock_adjustments (variant_id);
CREATE INDEX idx_product_images_product_id  ON product_images (product_id);

-- Tracking pool: fast "next available" and order → slot lookups.
CREATE INDEX idx_tracking_pool_available ON tracking_pool (created_at ASC) WHERE order_id IS NULL;
CREATE INDEX idx_tracking_pool_order     ON tracking_pool (order_id)       WHERE order_id IS NOT NULL;

-- Exchange chain lookups (which orders replace this one).
CREATE INDEX idx_orders_exchange_source ON orders (exchange_source_order_id)
  WHERE exchange_source_order_id IS NOT NULL;

-- ─── Analytics views (Home dashboard) ────────────────────────
-- security_invoker=true so they respect the querying user's RLS.
CREATE VIEW order_financials WITH (security_invoker = true) AS
SELECT
  o.id AS order_id,
  o.session_id,
  o.status,
  o.payment_type,
  o.is_exchange,
  o.order_discount,
  o.cod_amount_override,
  o.courier_charge_override,
  o.created_at,
  COALESCE(SUM(oi.unit_price * oi.qty - COALESCE(oi.line_discount, 0)), 0) AS items_total
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

GRANT SELECT ON order_financials TO authenticated;

CREATE VIEW order_item_sales WITH (security_invoker = true) AS
SELECT
  oi.id AS order_item_id,
  oi.order_id,
  oi.variant_id,
  oi.qty,
  oi.unit_price,
  oi.line_discount,
  (oi.unit_price * oi.qty - COALESCE(oi.line_discount, 0)) AS line_revenue,
  v.cost AS variant_cost,
  v.name AS variant_name,
  p.price_mode,
  p.global_cost,
  p.name AS product_name,
  o.status AS order_status,
  o.created_at AS order_created_at,
  o.is_exchange
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN variants v ON v.id = oi.variant_id
JOIN products p ON p.id = v.product_id;

GRANT SELECT ON order_item_sales TO authenticated;

-- ─── Row-level security ──────────────────────────────────────
ALTER TABLE settings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attributes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_values         ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_pool            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_columns           ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access; anon gets nothing (default deny).
CREATE POLICY "authenticated_full" ON settings                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON products                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON product_attributes       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON attribute_values         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON variants                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON variant_attribute_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON product_images           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON stock_adjustments        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON sessions                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON orders                   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON order_items              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON order_tracking           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON tracking_pool            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON dismissed_alerts         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full" ON export_columns           FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Storage bucket for variant / product images ─────────────
-- RESET_1 leaves Storage alone (SQL can't delete storage rows), so
-- the bucket and these policies may already exist. Everything here
-- is guarded so re-running is safe either way.
INSERT INTO storage.buckets (id, name, public)
VALUES ('variant-images', 'variant-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'authenticated_upload') THEN
    CREATE POLICY "authenticated_upload" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'variant-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'authenticated_update') THEN
    CREATE POLICY "authenticated_update" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'variant-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'authenticated_delete') THEN
    CREATE POLICY "authenticated_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'variant-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_read') THEN
    CREATE POLICY "public_read" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'variant-images');
  END IF;
END $$;

-- ─── Seed: default settings row ──────────────────────────────
INSERT INTO settings (
  business_name, address, phone1, phone2,
  slip_footer_text, default_low_stock_threshold,
  default_courier_charge, currency
) VALUES (
  'Nayora Clothing',
  'No 16, Kumudu Mawatha, Primrose Gardens, Kandy',
  '0774774670',
  '0777898768',
  'Nayora Clothing — No 16, Kumudu Mawatha, Primrose Gardens, Kandy — 0774774670 / 0777898768',
  5,
  450,
  'LKR'
);

-- ─── Seed: the real 13-column courier export layout ──────────
INSERT INTO export_columns (position, header_label, source, fallback_value, true_value, false_value) VALUES
  (1,  'TrackingNumber',    'tracking_numbers',    '',         NULL, NULL),
  (2,  'Reference',         'ref_id',              '',         NULL, NULL),
  (3,  'PackageDescription','package_description',  'Clothing', NULL, NULL),
  (4,  'ReceiverName',      'receiver_name',        '',         NULL, NULL),
  (5,  'ReceiverAddress',   'receiver_address',     '',         NULL, NULL),
  (6,  'ReceiverCity',      'receiver_city',        '',         NULL, NULL),
  (7,  'ReceiverContactNo', 'receiver_contact',     '',         NULL, NULL),
  (8,  'NoOfPcs',           'fixed',                '1',        NULL, NULL),
  (9,  'Kilo',              'kilo',                 '0',        NULL, NULL),
  (10, 'Gram',              'gram',                 '0',        NULL, NULL),
  (11, 'Amount',            'amount',               '0',        NULL, NULL),
  (12, 'Exchange',          'exchange',             '0',        '1',  '0'),
  (13, 'Remark',            'remark',               '0',        NULL, NULL);
