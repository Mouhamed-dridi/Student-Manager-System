-- ------------------------------------------------- center_settings realtime ---
-- The license gate (src/App.tsx) and the Settings > License tab subscribe to
-- postgres_changes on `center_settings`, so a key activated in one tab or by
-- another operator unlocks/locks every open tab without a reload.
--
-- postgres_changes only fires for tables in the supabase_realtime publication,
-- and the original schema listed the data tables but not this one. Paste this
-- block into the SQL Editor once; it is idempotent.
--
-- The app also re-reads row 1 on tab focus and right after a local activation,
-- so realtime is a convenience: without this migration the license still
-- activates and locks correctly, it just needs a refocus to see another tab's
-- change.

do $$
begin
  alter publication supabase_realtime add table public.center_settings;
exception
  when duplicate_object then null;
end $$;
