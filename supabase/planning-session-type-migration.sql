-- Planning: classify each session as In-class, Online, Exam, or Soutenance.
-- Existing rows receive the default when the column is added.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.

alter table public.planning
  add column if not exists session_type text not null default 'In-class';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planning_session_type_check'
      and conrelid = 'public.planning'::regclass
  ) then
    alter table public.planning
      add constraint planning_session_type_check
      check (session_type in ('In-class', 'Online', 'Exam', 'Soutenance'));
  end if;
end $$;
