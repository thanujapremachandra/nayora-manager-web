-- "Written" orders: an alternative to picking items from stock, where the
-- operator types the order contents free-hand into a small textbox.
--
-- items_text NULL  -> a normal stock-picked order (uses order_items).
-- items_text set   -> a written order: no order_items, no stock impact.
--                     Its COD comes from cod_amount_override (entered manually
--                     in the "Amount to collect" box).

ALTER TABLE orders ADD COLUMN items_text text;

-- Global default for which entry mode the order dialog opens in. Individual
-- orders still toggle freely (until stock items are added, which locks them
-- to stock mode).
ALTER TABLE settings
  ADD COLUMN default_order_entry_mode text NOT NULL DEFAULT 'stock'
  CHECK (default_order_entry_mode IN ('stock', 'text'));
