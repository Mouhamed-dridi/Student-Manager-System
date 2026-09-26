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

-- Extended student profile (idempotent: databases that already carry these
-- columns keep them untouched).
alter table if exists public.students
  add column if not exists location text,
  add column if not exists education text,
  add column if not exists age integer,
  add column if not exists engagement text;

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

-- Extended teacher professional profile (idempotent: databases that already
-- carry these columns keep them untouched).
alter table if exists public.teachers
  add column if not exists job_title text,
  add column if not exists company text,
  add column if not exists location text,
  add column if not exists education text,
  add column if not exists program text,
  add column if not exists training text;

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

-- Program/training tracking and shared-trash support for absences
-- (idempotent: databases that already carry these columns keep them untouched).
alter table if exists public.attendance
  add column if not exists program text,
  add column if not exists training text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists attendance_log_idx
  on public.attendance (date, full_name);

-- Reconciliation: backfills NULL program/training on attendance rows from the
-- matching student/teacher profiles (case-insensitive full_name match, same
-- rule the app uses). Explicit stored values are never overwritten. Run from
-- the SQL Editor or via the Settings > System "Sync Data" button (JS path is
-- src/lib/api.ts -> reconcileAttendanceProfiles).
create or replace function public.reconcile_attendance_profiles()
returns table (
  scanned bigint,
  needing_fix bigint,
  updated bigint,
  unmatched bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated bigint;
begin
  select count(*) into scanned from public.attendance;
  select count(*) into needing_fix
    from public.attendance
    where program is null or training is null;

  with people as (
    select 'student'::text as person_type, lower(full_name) as lower_name,
           program, training
    from public.students
    union all
    select 'teacher'::text, lower(full_name), program, training
    from public.teachers
  )
  update public.attendance a
  set program = coalesce(a.program, p.program),
      training = coalesce(a.training, p.training)
  from people p
  where p.person_type = a.type
    and p.lower_name = lower(a.full_name)
    and (a.program is null or a.training is null)
    and coalesce(p.program, p.training) is not null;

  get diagnostics v_updated = row_count;
  updated := v_updated;

  select count(*) into unmatched
    from public.attendance
    where program is null or training is null;
end;
$$;

grant execute on function public.reconcile_attendance_profiles() to anon, authenticated;

-- ---------------------------------------------------------------- courses --
-- Teacher-created schedule entries. Seeded demo courses live in the app code
-- (src/lib/trainings.ts), not here. Thumbnails are uploaded to the
-- 'cours' Storage bucket; thumbnail_url holds the public URL.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  program_id uuid references programs(id),
  training_id uuid references trainings(id),
  day text,
  time_slot text,
  teacher_id uuid,
  thumbnail_url text,
  published_at timestamptz
);

-- Course description shown on teacher/student course cards (idempotent for
-- databases that already have the column).
alter table if exists public.courses
  add column if not exists description text;

-- Attached course materials ({name,type,url}) shown/downloadable in the student
-- portal's course detail view (idempotent). The app runtime-probes for this
-- column before writing, so teacher course saves still work on databases where
-- this block hasn't been run yet.
alter table if exists public.courses
  add column if not exists materials jsonb;

-- Coursera-style course detail metadata, all optional so existing course rows
-- stay valid. The app runtime-probes each column before writing it (same
-- pattern as `materials`), so courses still save on a database where this
-- block has not been run yet.
alter table if exists public.courses
  add column if not exists subtitle text;

-- Difficulty level: 'beginner' | 'medium' | 'expert'
alter table if exists public.courses
  add column if not exists level text;

-- Estimated length in minutes, e.g. 90 renders as "1h 30m".
alter table if exists public.courses
  add column if not exists duration_minutes integer;

-- Delivery format: 'video' | 'document' | 'mixed'
alter table if exists public.courses
  add column if not exists format text;

-- Key competencies shown as "Skills you'll gain", stored as a string array.
alter table if exists public.courses
  add column if not exists skills jsonb;

-- Free-text syllabus: one topic per line, rendered as an ordered list.
alter table if exists public.courses
  add column if not exists syllabus text;

-- ---------------------------------------------------------- course reviews --
-- Student star ratings + comments on a course. Append-only: a student may post
-- more than one review and the course average spans all of them.
-- `student_name` is a denormalised snapshot (like the attendance log) so a
-- renamed or trashed student never breaks an existing review. student_id has no
-- FK for the same reason: students are soft-deleted, never removed.

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  student_id uuid,
  student_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists course_reviews_course_idx
  on public.course_reviews (course_id, created_at desc);

-- -------------------------------------------- Storage: course thumbnails ---
-- Course thumbnail images live in Supabase Storage, not in the database, in
-- the 'cours' bucket. The bucket must exist before uploads succeed; paste
-- this block into the SQL Editor (it is idempotent).
--
-- Roles: the app has NO Supabase Auth accounts — teachers use the anon/
-- publishable key (cookie sessions), so uploads come in as `anon`.
-- `authenticated` is added too so the bucket keeps working if real auth is
-- ever enabled. Policy names must stay unique per role.

insert into storage.buckets (id, name, public)
values ('cours', 'cours', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "cours read anon" on storage.objects;
create policy "cours read anon"
  on storage.objects for select
  to anon
  using (bucket_id = 'cours');

drop policy if exists "cours read authenticated" on storage.objects;
create policy "cours read authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cours');

drop policy if exists "cours insert anon" on storage.objects;
create policy "cours insert anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'cours');

drop policy if exists "cours insert authenticated" on storage.objects;
create policy "cours insert authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cours');

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
  foreach t in array array[
    'students', 'teachers', 'courses', 'publications', 'course_reviews'
  ]
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
    'exams', 'grades', 'publications', 'planning', 'settings',
    'course_reviews'
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
