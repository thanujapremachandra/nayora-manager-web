-- Trigram indexes so ilike '%substring%' search scales as order volume grows.
-- Plain btree indexes don't help leading-wildcard ilike; pg_trgm GIN indexes do.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_orders_ref_id_trgm ON orders USING gin (ref_id gin_trgm_ops);
CREATE INDEX idx_orders_customer_name_trgm ON orders USING gin (customer_name gin_trgm_ops);
CREATE INDEX idx_orders_phone1_trgm ON orders USING gin (phone1 gin_trgm_ops);
CREATE INDEX idx_orders_phone2_trgm ON orders USING gin (phone2 gin_trgm_ops);
CREATE INDEX idx_order_tracking_number_trgm ON order_tracking USING gin (tracking_number gin_trgm_ops);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Plain indexes for the common exact-match lookups (session detail, joins).
CREATE INDEX idx_orders_session_id ON orders (session_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_variant_id ON order_items (variant_id);
CREATE INDEX idx_order_tracking_order_id ON order_tracking (order_id);
CREATE INDEX idx_variants_product_id ON variants (product_id);
CREATE INDEX idx_stock_adjustments_variant_id ON stock_adjustments (variant_id);
