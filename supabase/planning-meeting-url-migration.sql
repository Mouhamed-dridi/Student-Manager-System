-- Planning: Microsoft Teams join link on an Online session.
--
-- `meeting_url` holds the link the teacher pasted in the entry form
-- ("https://teams.microsoft.com/l/meetup-join/..."). It is only ever set on an
-- `Online` entry: switching the session back to `In-class` clears the column, so
-- an in-person session never keeps a leftover link. Teacher and student cards
-- render it as a "Join Teams" link. Existing rows get NULL.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
-- The app probes for this column (`hasPlanningMeetingUrlColumn()` in
-- src/lib/api.ts) and refuses a save that carries a link until it exists; an
-- empty value only clears an existing one, so ordinary saves keep working.

alter table public.planning
  add column if not exists meeting_url text;

-- The existing planning_anon_all policy from schema.sql covers the new column;
-- no policy change is needed (the app has no Supabase Auth, so RLS cannot
-- scope rows per role). Meeting links are never sensitive: they are handed to
-- the class anyway, and the client shares the anon key by design.
