-- User-pickable primary color (Settings → Appearance). Stored as a hex
-- string ('#7c3aed' style); NULL means "use the built-in violet default".
-- The app derives the full light/dark shade ramp from this single hex at
-- render time — only one value needs storing.
ALTER TABLE settings ADD COLUMN brand_color text;
