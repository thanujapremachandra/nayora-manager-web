-- Configurable pricing behaviours + auto-weight, plus a per-order "legacy"
-- escape hatch that detaches a single order from these global settings.

-- ─── Settings: new global behaviour toggles ──────────────────
-- Exchange orders currently collect Rs. 0. This lets you instead keep the
-- courier charge on exchanges (collect just the delivery fee).
ALTER TABLE settings ADD COLUMN exchange_keep_courier_charge boolean NOT NULL DEFAULT false;

-- Bank-transfer orders currently collect Rs. 0 (already paid). This lets you
-- instead collect the full amount at delivery, like a COD order.
ALTER TABLE settings ADD COLUMN bank_transfer_collect boolean NOT NULL DEFAULT false;

-- Auto-weight: when enabled, an order with no manually entered weight gets a
-- weight derived from either its item count or its item subtotal — over the
-- threshold → "over" grams, at/under → "under" grams.
ALTER TABLE settings ADD COLUMN auto_weight_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE settings ADD COLUMN auto_weight_mode text NOT NULL DEFAULT 'count'
  CHECK (auto_weight_mode IN ('count', 'price'));
ALTER TABLE settings ADD COLUMN auto_weight_threshold numeric(12, 2) NOT NULL DEFAULT 3;
ALTER TABLE settings ADD COLUMN auto_weight_over_grams int NOT NULL DEFAULT 1000;
ALTER TABLE settings ADD COLUMN auto_weight_under_grams int NOT NULL DEFAULT 800;

-- ─── Orders: per-order "legacy" override ─────────────────────
-- legacy_mode = true detaches this one order from the three settings above and
-- uses its own *_override values instead (NULL just means "not set yet", which
-- falls back to the global value). When legacy_mode = false the overrides are
-- ignored entirely.
ALTER TABLE orders ADD COLUMN legacy_mode boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN exchange_keep_courier_override boolean;
ALTER TABLE orders ADD COLUMN bank_collect_override boolean;
ALTER TABLE orders ADD COLUMN auto_weight_override boolean;

-- Written ("write it") orders have no order_items; their typed amount is the
-- item subtotal (courier charge is added on top, same as a stock order).
-- Kept separate from cod_amount_override, which is an exact final-COD override
-- used by imported orders.
ALTER TABLE orders ADD COLUMN items_amount numeric(12, 2);
