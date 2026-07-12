-- Tracks which orders were marked sent by a specific "Complete session"
-- bulk action (as opposed to an individual mark-sent), so that action can
-- be undone precisely without touching orders changed individually since.
ALTER TABLE orders ADD COLUMN dispatched_via_session_complete_at timestamptz;
