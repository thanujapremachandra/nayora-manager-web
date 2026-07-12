-- Lets the user design their own slip front layout (Settings → Slip Designer)
-- instead of the built-in hardcoded layout. Null = use the built-in default.
ALTER TABLE settings ADD COLUMN slip_template jsonb;
