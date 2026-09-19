-- ============================================================================
-- SSM — full database schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- It is idempotent: safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------- programs/trainings --

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- people ---

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  program_id uuid references programs(id),
  training_id uuid references trainings(id),
  phone text,
  email text unique,
  password text not null default 'std123',
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null default '',
  phone text,
  email text unique,
  password text not null default 'tch123',
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- payments ---
-- One row per recorded payment. Student details are not snapshotted here;
-- join to students.student_id to resolve the name at read time.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  amount numeric not null,
  plan_type text check (plan_type in ('one_time', 'semester', 'monthly')),
  payment_date date,
  status text check (status in ('paid', 'pending')),
  created_at timestamptz not null default now()
);

-- Trash + audit columns (idempotent for databases that already have them):
-- is_deleted = true moves the payment to the Pay > Trash view instead of
-- deleting it; deleted_at records when; edit_history (jsonb array) stores
-- one entry per edit ({changedAt, changedBy, changes:[{field, from, to}]})
-- so the Pay > History view can replay all modifications.
alter table if exists public.payments
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists edit_history jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------ general trash ---
-- Soft-delete columns for the operator Trash page (Payments has its own
-- columns above). is_deleted = true moves the row to Trash; deleted_at
-- records when. The app probes these at runtime and falls back to in-memory
-- tracking when they are absent, so no query ever references a missing
-- column.

alter table if exists public.students
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table if exists public.teachers
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table if exists public.publications
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------- settings -
-- Operator-level SaaS settings as a simple key/value store.

create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- attendance --
-- Unified attendance log: one row per recorded presence. Each row is fully
-- denormalised (type, full_name, class_name) so the table renders as-is and
-- the search filter can be pushed down into the Supabase query (ilike).
-- type is 'student' or 'teacher'; class_name holds the program·training for
-- students or the specialty for teachers.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('student', 'teacher')),
  full_name text not null,
  class_name text,
  date date,
  time text,
  created_at timestamptz not null default now()
);

create index if not exists attendance_log_idx
  on public.attendance (date, full_name);

-- ---------------------------------------------------------------- courses --
-- Teacher-created schedule entries. Seeded demo courses live in the app code
-- (src/lib/trainings.ts), not here. materials holds {name, type} metadata.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  program_id uuid references programs(id),
  training_id uuid references trainings(id),
  day text,
  time text,
  teacher_id uuid,
  thumbnail_url text,
  published_at timestamptz,
  materials jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ exams --
-- Owned by the teacher who created them; snapshots the course's program and
-- training so the class roster for grading stays resolvable.

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
  foreach t in array array['students', 'teachers', 'courses', 'publications']
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
    'exams', 'grades', 'publications', 'planning', 'settings'
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
