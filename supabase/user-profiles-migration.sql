-- Per-portal profile records: avatar + social links.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- This table already exists in the live deployment; the file documents its
-- exact shape so a database created from schema.sql can add it. `user_id` is
-- the id of the teacher/student row the portal session belongs to (there is no
-- Supabase Auth in this app), and `role` distinguishes the two portals for the
-- same person id.
--
-- Uniqueness is on (user_id, role) and named `unique_user_role`: the client
-- upserts with `on_conflict=user_id,role`, which PostgREST rejects (42P10) if
-- the matching constraint is missing.
--
-- RLS follows the rest of the schema: one shared anon key, so the policy is
-- permissive by design. Never store anything sensitive here.

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('teacher', 'student')),
  first_name text,
  last_name text,
  avatar_url text,
  linkedin_url text,
  whatsapp_number text,
  github_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Matches the live constraint the upsert relies on.
create unique index if not exists unique_user_role
  on public.user_profiles (user_id, role);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_anon_all on public.user_profiles;
create policy user_profiles_anon_all on public.user_profiles
  for all
  using (true)
  with check (true);
