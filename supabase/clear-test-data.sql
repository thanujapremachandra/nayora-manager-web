-- Wipes all business data (products, stock, sessions, orders) for a clean
-- testing slate. Leaves the database/tables themselves intact, and does
-- NOT touch `settings` or `export_columns` — your configured business
-- info, courier charge, and Excel export layout are untouched.
--
-- Run in Supabase dashboard → SQL Editor. Safe to re-run anytime.

TRUNCATE TABLE
  stock_adjustments,
  order_tracking,
  order_items,
  orders,
  variant_attribute_values,
  variants,
  attribute_values,
  product_attributes,
  products,
  sessions,
  dismissed_alerts
RESTART IDENTITY CASCADE;

-- Order ref_ids (NYR-0001, NYR-0002, ...) come from a standalone sequence,
-- not a column identity, so RESTART IDENTITY above doesn't reset it.
ALTER SEQUENCE order_ref_seq RESTART WITH 1;
