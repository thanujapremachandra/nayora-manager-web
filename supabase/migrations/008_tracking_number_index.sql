-- Exact-match lookups (duplicate-tracking-number warning) need a plain
-- btree index — the existing trigram index (migration 004) is tuned for
-- ILIKE substring search, not equality lookups.
CREATE INDEX idx_order_tracking_number ON order_tracking (tracking_number);
