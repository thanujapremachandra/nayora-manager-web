-- ============================================================
-- RESET 1 of 3  —  NUKE THE DATABASE
-- ============================================================
-- Drops EVERYTHING this app owns in the `public` schema: all
-- tables, views, functions, sequences, types and RLS policies.
--
-- What it deliberately does NOT touch:
--   • the Supabase `auth` schema — your registered / logged-in
--     users (auth.users, the `authenticator` role) survive, so you
--     can still sign in after.
--   • Storage — the `variant-images` bucket, its files, and its RLS
--     policies live in the `storage` schema (not `public`), and
--     Supabase blocks deleting storage rows from SQL. They're left
--     as-is; RESET_2 reuses the existing bucket/policies. To also
--     wipe the uploaded images, empty the `variant-images` bucket
--     from the Storage section of the Supabase dashboard.
--
-- ⚠️  IRREVERSIBLE. Deletes ALL table data.
--
-- After running this, run:  RESET_2_rebuild_full_schema.sql
-- ============================================================

-- ── The entire public schema in one shot. CASCADE takes the ──
--    tables, views, sequences, functions, triggers, types and
--    policies with it.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ── Restore the standard Supabase grants on the fresh schema. ──
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
