-- Lets the user freely place multiple slips on an A4 sheet (any orientation,
-- any size/position per slip) instead of the built-in single-column layout.
-- The back page is derived automatically (mirrored) from this, not stored.
-- Null = use the built-in default placement (single column, 3 per page).
ALTER TABLE settings ADD COLUMN slip_placement_layout jsonb;
