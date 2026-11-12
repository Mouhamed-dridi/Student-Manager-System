-- ============================================================================
-- SSM — Branches: the class record behind a training, plus its materials
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: safe to run more than once.
--
-- `branches` is the operator-facing class row (level + name) and mirrors one
-- training through `training_id`; the weekly timetable and the roster stay
-- scoped by that training id, so nothing else has to change.
-- `branch_materials` is the module list of one class with ONE teacher per
-- material, which is how a single class ends up staffed by several teachers.
-- ============================================================================

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  -- CAP / BTP / BTS: the track badge the Branches page shows.
  level text not null check (level in ('CAP', 'BTP', 'BTS')),
  name text not null,
  training_id uuid references public.trainings(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.branch_materials (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  description text,
  -- NULL = material not assigned yet. Deleting a teacher unassigns it instead
  -- of destroying the class's module list.
  teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists branch_materials_branch_id_idx
  on public.branch_materials (branch_id);

-- ------------------------------------------------------------------- RLS ---
-- The app has no Supabase Auth: every client shares the anon/publishable key,
-- so these policies are the same `using (true) with check (true)` ones the
-- rest of the schema uses. RLS grants no authorization here — never store
-- anything sensitive in these rows.

alter table public.branches enable row level security;
drop policy if exists branches_anon_all on public.branches;
create policy branches_anon_all on public.branches
  for all using (true) with check (true);

alter table public.branch_materials enable row level security;
drop policy if exists branch_materials_anon_all on public.branch_materials;
create policy branch_materials_anon_all on public.branch_materials
  for all using (true) with check (true);
