-- Planning: optional daily lesson material on a Course & Materials entry.
--
-- `material_url` holds the public link of the file/link the teacher attached
-- (uploads go to the existing `cours-PDF` / `cours-videos` / `cours-covers`
-- buckets through uploadCourseMaterial()), and `material_name` is the label
-- shown on the paperclip badge. Students see both on their schedule for that
-- day. Existing rows get NULL.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
-- The app probes for these columns (`hasPlanningMaterialColumns()` in
-- src/lib/api.ts) and refuses a save that carries a material until they exist;
-- an empty value only clears an existing one, so ordinary saves keep working.

alter table public.planning
  add column if not exists material_url text;

alter table public.planning
  add column if not exists material_name text;

-- The existing planning_anon_all policy from schema.sql covers the new columns;
-- no policy change is needed (the app has no Supabase Auth, so RLS cannot
-- scope rows per role).
