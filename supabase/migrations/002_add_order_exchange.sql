-- Adds the exchange-order flag agreed on with the user during M3 planning.
-- Exchange orders (we send a new package, customer returns the old one) need
-- a first-class flag so the courier export (M4) can fill Amount=0/Exchange=Y.
ALTER TABLE orders ADD COLUMN is_exchange boolean NOT NULL DEFAULT false;
