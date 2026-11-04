-- Planning: optional internal note per session.
--
-- The operator's session modal has a free-text "Comment / notes" field. It is
-- administrative only: the student and teacher planning views never render it.
-- Existing rows get NULL.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
-- The app probes for this column (`hasPlanningNotesColumn()` in src/lib/api.ts)
-- and refuses a save that carries a note until it exists.

alter table public.planning
  add column if not exists notes text;

-- The existing planning_anon_all policy from schema.sql covers the new column;
-- no policy change is needed (the app has no Supabase Auth, so RLS cannot
-- scope rows per role).
