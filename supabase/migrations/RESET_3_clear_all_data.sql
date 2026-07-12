-- ============================================================
-- RESET 3 of 3  —  CLEAR ALL DATA (keep the schema)
-- ============================================================
-- Empties every table but leaves the database structure — tables,
-- views, functions, indexes, policies — completely intact. Use
-- this for a fresh start WITHOUT tearing down and rebuilding.
--
-- It then re-seeds the two config tables the app needs to boot
-- (the singleton `settings` row and the courier `export_columns`
-- layout) and resets the order reference counter to NYR-0001.
--
-- ⚠️  IRREVERSIBLE for the data. Structure is untouched.
-- ============================================================

-- ── Wipe every table in one shot. CASCADE satisfies the FKs; ──
--    RESTART IDENTITY resets any identity/serial sequences.
TRUNCATE
  order_items,
  order_tracking,
  tracking_pool,
  stock_adjustments,
  orders,
  sessions,
  variant_attribute_values,
  variants,
  attribute_values,
  product_attributes,
  product_images,
  products,
  dismissed_alerts,
  export_columns,
  settings
RESTART IDENTITY CASCADE;

-- The order ref counter is a standalone sequence (used in a column
-- DEFAULT, not an identity column), so RESTART IDENTITY above does
-- not touch it — reset it explicitly.
ALTER SEQUENCE order_ref_seq RESTART WITH 1;

-- Note: to also wipe uploaded images for a truly blank slate, empty
-- the `variant-images` bucket from the Storage section of the
-- Supabase dashboard — SQL can't delete storage rows (Supabase
-- blocks it with a protection trigger).

-- ── Re-seed the config the app needs to run ──────────────────
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
