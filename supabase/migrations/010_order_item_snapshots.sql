-- Item descriptions were a live reference to the current product/variant
-- name — renaming a product after orders shipped would silently rewrite
-- history. These snapshots are captured once, when the item is added, and
-- never change afterward. Nullable because existing rows predate this;
-- display code falls back to the live lookup when null.
ALTER TABLE order_items ADD COLUMN product_name_snapshot text;
ALTER TABLE order_items ADD COLUMN variant_label_snapshot text;
