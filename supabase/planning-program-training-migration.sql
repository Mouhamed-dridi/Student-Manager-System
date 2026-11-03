-- ============================================================================
-- planning: class scope columns (program_id / training_id)
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: safe to run more than once.
--
-- The student Planning view needs to find the sessions logged for its class.
-- Until now a planning row only carried the display label in `class_name`
-- ("BTS · Réseaux et sécurité informatique"), so a rename of a program or a
-- training silently hid every existing session from students. The FKs below
-- give the row a stable scope that survives renames.
--
-- `class_name` is intentionally kept: it is the label shown in both portals and
-- remains the fallback for databases that have not run this migration yet.
-- ============================================================================

alter table public.planning
  add column if not exists program_id uuid references public.programs(id),
  add column if not exists training_id uuid references public.trainings(id);

create index if not exists planning_program_training_idx
  on public.planning (program_id, training_id);

-- Backfill the rows written before the columns existed. The class label was
-- built by classNameFor(program code, training name) and joined with " · ".
update public.planning p
set program_id = pr.id
from public.programs pr
where p.program_id is null
  and p.class_name is not null
  and split_part(p.class_name, ' · ', 1) = pr.code;

update public.planning p
set training_id = t.id
from public.trainings t
where p.training_id is null
  and p.program_id = t.program_id
  and p.class_name is not null
  and split_part(p.class_name, ' · ', 2) = t.name;

-- The existing <table>_anon_all policy from schema.sql already covers these
-- columns; no policy change is needed (the app has no Supabase Auth, so RLS
-- cannot scope rows per student — the app filters by the student's class).
