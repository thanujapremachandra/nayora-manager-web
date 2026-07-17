-- Card/panel outline (border) color per theme (Settings → Appearance).
-- Hex strings; NULL = built-in defaults. Overrides the --gray-200 token,
-- which is the border color used by cards, dialogs, tables and the nav.
ALTER TABLE settings ADD COLUMN outline_color_light text;
ALTER TABLE settings ADD COLUMN outline_color_dark text;
