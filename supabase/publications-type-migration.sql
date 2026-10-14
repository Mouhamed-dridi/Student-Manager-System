-- ============================================================================
-- publications-type-migration.sql — add the Notification Type column to the
-- live `publications` table
--
-- WHY THIS FILE EXISTS
--   `CREATE TABLE IF NOT EXISTS public.publications (...)` in schema.sql will
--   NOT add a missing column to a table that already exists, so a deployment
--   created before the Notification Type feature keeps its old shape. The app
--   probes for `type` at runtime and simply omits it on INSERT when absent, so
--   nothing breaks — but the selected type is then not stored until this runs.
--
-- HOW TO APPLY
--   Paste this whole file into the Supabase SQL Editor and run it. It is
--   idempotent, so re-running is safe. Existing rows default to 'info'.
-- ============================================================================

alter table public.publications
  add column if not exists type text not null default 'info';

-- Guard the value domain, tolerating a pre-existing constraint of the same name.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'publications_type_check'
  ) then
    alter table public.publications
      add constraint publications_type_check
      check (type in ('urgent', 'warning', 'info'));
  end if;
end $$;
