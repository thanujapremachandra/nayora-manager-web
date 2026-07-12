-- Replaces the unused weight-tier courier charge with a flat default (user
-- confirmed: Rs. 450 flat, no real weight tiers exist yet).
ALTER TABLE settings DROP COLUMN courier_tiers;
ALTER TABLE settings ADD COLUMN default_courier_charge numeric(12, 2) NOT NULL DEFAULT 450;

-- Per-order override of the courier "PackageDescription" field; falls back
-- to the export column's configured default ("Clothing") when null.
ALTER TABLE orders ADD COLUMN package_description text;

-- User-configurable courier Excel export columns (Settings → Excel Export).
-- Generated fresh on each export (no uploaded template to preserve), so the
-- column list + order here IS the sheet layout.
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

ALTER TABLE export_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full" ON export_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with the exact 13-column layout the user described.
INSERT INTO export_columns (position, header_label, source, fallback_value, true_value, false_value) VALUES
  (1,  'TrackingNumber',    'tracking_numbers',    '',         NULL, NULL),
  (2,  'Reference',         'ref_id',               '',         NULL, NULL),
  (3,  'PackageDescription','package_description',  'Clothing', NULL, NULL),
  (4,  'ReceiverName',      'receiver_name',         '',         NULL, NULL),
  (5,  'ReceiverAddress',   'receiver_address',      '',         NULL, NULL),
  (6,  'ReceiverCity',      'receiver_city',         '',         NULL, NULL),
  (7,  'ReceiverContactNo', 'receiver_contact',      '',         NULL, NULL),
  (8,  'NoOfPcs',           'fixed',                 '1',        NULL, NULL),
  (9,  'Kilo',              'kilo',                  '0',        NULL, NULL),
  (10, 'Gram',               'gram',                  '0',        NULL, NULL),
  (11, 'Amount',             'amount',                '0',        NULL, NULL),
  (12, 'Exchange',           'exchange',              '0',        '1',  '0'),
  (13, 'Remark',             'remark',                '0',        NULL, NULL);
