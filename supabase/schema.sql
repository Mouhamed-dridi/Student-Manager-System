-- ============================================================================
-- SSM — full database schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- It is idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------- people ---

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  program text,
  training text,
  phone text,
  email text,
  password text,          -- null = this student has no login account
  blocked boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  program text,
  training text,
  phone text,
  email text,
  password text,          -- null = this teacher has no login account
  blocked boolean default false,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- payments ---
-- Keeps a snapshot of the student's name/class so payment history survives
-- student edits and deletions (mirrors the original app behaviour).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  amount numeric not null,
  plan_type text,
  date date,
  status text,
  student_name text,
  student_program text,
  student_training text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- attendance --
-- One row per person per day. person_type is 'student' or 'teacher'.

create table if not exists public.attendance (
  id bigint generated always as identity primary key,
  person_type text not null,
  person_id uuid not null,
  date date not null,
  present boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists attendance_person_day_idx
  on public.attendance (person_type, person_id, date);

-- ---------------------------------------------------------------- courses --
-- Teacher-created schedule entries. Seeded demo courses live in the app code
-- (src/lib/trainings.ts), not here. materials holds {name, type} metadata.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  program text,
  training text,
  day text,
  time text,
  teacher_id uuid,
  thumbnail_url text,
  published_at timestamptz,
  materials jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ exams --
-- Scoped to the teacher's class (program/training); course stored by NAME
-- because seeded schedule courses have no database id.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid,
  program text,
  training text,
  title text not null,
  date date,
  course text,
  file_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null,
  student_id uuid not null,
  score numeric,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------- publications --

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  recipients text[] not null default '{}',
  channels text[] not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- planning -
-- Lesson log: one entry per session; 'topic' holds what was covered.

create table if not exists public.planning (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid,
  date date not null,
  course text,
  topic text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Realtime -
-- Pages that stay open (operator Student List, teacher Class/Courses)
-- subscribe to postgres_changes, which only fires for tables in the
-- supabase_realtime publication. Idempotent: re-adding errors and is
-- swallowed.

do $$
declare
  t text;
begin
  foreach t in array array['students', 'courses']
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- --------------------------------------------------------------------- RLS -
-- The app has no Supabase Auth accounts; everyone shares the same data via
-- the publishable/anon key, so these policies allow full access for `anon`.
do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'teachers', 'payments', 'attendance', 'courses',
    'exams', 'grades', 'publications', 'planning'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format(
        'create policy %I on public.%I for all to anon using (true) with check (true)',
        t || '_anon_all', t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
