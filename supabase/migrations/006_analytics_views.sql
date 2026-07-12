-- Read-only aggregation views for the Home dashboard (M5). Computing these
-- in Postgres avoids fetching full nested order data into JS just to sum
-- totals — important since order volume is expected to be high.
--
-- security_invoker=true makes these views respect the querying user's RLS
-- (otherwise views default to running as their owner, bypassing RLS).

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
  o.created_at AS order_created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN variants v ON v.id = oi.variant_id
JOIN products p ON p.id = v.product_id;

GRANT SELECT ON order_item_sales TO authenticated;
