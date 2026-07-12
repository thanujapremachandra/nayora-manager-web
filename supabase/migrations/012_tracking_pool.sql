-- A pool of courier tracking numbers that can be uploaded in bulk and
-- automatically assigned to orders as they are created.
--
-- order_id is nullable: NULL means the slot is available for the next order.
-- ON DELETE SET NULL lets the pool entry become available again when an order
-- is deleted, without any application-level cleanup code.

CREATE TABLE tracking_pool (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text        NOT NULL,
  order_id       uuid         REFERENCES orders(id) ON DELETE SET NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT tracking_pool_number_unique UNIQUE (tracking_number)
);

-- fast "next available" query (WHERE order_id IS NULL ORDER BY created_at)
CREATE INDEX idx_tracking_pool_available ON tracking_pool (created_at ASC) WHERE order_id IS NULL;
-- fast order → pool lookup (used when checking whether an order already has a slot)
CREATE INDEX idx_tracking_pool_order ON tracking_pool (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE tracking_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full" ON tracking_pool
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
