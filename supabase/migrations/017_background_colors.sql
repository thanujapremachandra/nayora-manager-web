-- Page background color per theme (Settings → Appearance), alongside the
-- card colors from 016. Hex strings; NULL = built-in defaults
-- (near-white #F9FAFB / near-black #0C0B14).
ALTER TABLE settings ADD COLUMN bg_color_light text;
ALTER TABLE settings ADD COLUMN bg_color_dark text;
