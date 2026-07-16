-- Exchange order linking + per-theme card colors.

-- ─── Card background colors (Settings → Appearance) ──────────
-- Hex strings; NULL = the built-in defaults (white / #17171D).
ALTER TABLE settings ADD COLUMN card_color_light text;
ALTER TABLE settings ADD COLUMN card_color_dark text;

-- ─── Exchange linking ─────────────────────────────────────────
-- An exchange order points at the order it replaces. ON DELETE SET NULL:
-- deleting the old order breaks the link but keeps the new one. Chaining
-- happens naturally (the source order can itself be an exchange).
ALTER TABLE orders ADD COLUMN exchange_source_order_id uuid REFERENCES orders (id) ON DELETE SET NULL;
CREATE INDEX idx_orders_exchange_source ON orders (exchange_source_order_id)
  WHERE exchange_source_order_id IS NOT NULL;

-- ─── order_item_sales: expose is_exchange ─────────────────────
-- Product sales/revenue metrics need to net out exchanges (stock leaves,
-- but no money is collected) — add the flag to the view.
CREATE OR REPLACE VIEW order_item_sales WITH (security_invoker = true) AS
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
