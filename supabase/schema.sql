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
  add column if not exists engagement text,
  -- Optional social profile links the student edits in the student portal's
  -- Settings page (ProfileEditor). Free text so a handle, a full URL or a
  -- wa.me number can all be stored as typed.
  add column if not exists facebook text,
  add column if not exists instagram text,
  add column if not exists whatsapp text,
  add column if not exists github text,
  add column if not exists linkedin text;

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
-- (src/lib/trainings.ts), not here. Thumbnails and course materials are
-- uploaded to the per-media-type Storage buckets declared further down;
-- thumbnail_url and the material URLs hold the public URL.

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
-- stay valid. NOTE: these names and types match the columns already deployed in
-- the Supabase project — `level`, `format` and `duration` hold short display
-- strings (e.g. 'Beginner', 'Video & Document', '1h 30m'), not enum keys or a
-- minute count. Do not "fix" them to integer minutes without migrating the
-- existing rows.
alter table if exists public.courses
  add column if not exists subtitle text;

-- Difficulty level: 'Beginner' | 'Intermediate' | 'Expert'
alter table if exists public.courses
  add column if not exists level text;

-- Estimated length as a display string, e.g. '1h 30m'.
alter table if exists public.courses
  add column if not exists duration text;

-- Delivery format, e.g. 'Video', 'Document' or 'Video & Document'.
alter table if exists public.courses
  add column if not exists format text;

-- Key competencies shown as "Skills you'll gain". text[] (not jsonb) to match
-- the already-deployed column; api.ts writes a plain string[].
alter table if exists public.courses
  add column if not exists skills text[];

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

-- ------------------------------------------------------------------ events --
-- Rich events and publications created from the admin panel (Hackathon,
-- Event, Publication, New Training, Certification). This is a DIFFERENT thing
-- from the `publications` table above, which is a broadcast message sent to
-- recipients; these rows are dated activities with a cover image, partners,
-- prizes and participants.
--
-- `organizers` / `members` hold teacher / student ids. They deliberately have NO
-- foreign key and no denormalised name: teachers and students are soft-deleted,
-- so a cascade or a stale snapshot would lose the assignment. The admin page
-- resolves the names from listTeachers()/listStudents() at read time and simply
-- skips ids that no longer resolve.
--
-- Soft delete matches the rest of the app: is_deleted/deleted_at, and every
-- read filters `.or("is_deleted.is.false,is_deleted.is.null")`.
--
-- The `type` column is free text (not an enum) so a new kind of event can be
-- added from the form without a migration; the app constrains it to the five
-- documented values.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'Event',
  description text,
  starts_on date,
  ends_on date,
  event_time text,
  -- JSON array of {name, link} objects, so a partner shows a readable label
  -- next to its own URL. jsonb rather than two text[] columns because the pairs
  -- are edited together; the app reads plain strings (from an older text[]
  -- build) as name-only partners.
  partners jsonb not null default '[]'::jsonb,
  gifts_awards text,
  organizers uuid[] not null default '{}',
  members uuid[] not null default '{}',
  cover_url text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists events_created_idx
  on public.events (created_at desc);

-- Earlier builds of this file declared `partners` as text[]. If that version was
-- already applied, widen the column instead of leaving the old shape behind:
-- casting text[] to jsonb yields a JSON array of strings, which the app reads as
-- name-only partners, so no row is lost. A no-op once the column is jsonb.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'partners'
      and data_type = 'ARRAY'
  ) then
    alter table public.events
      alter column partners type jsonb using to_jsonb(partners);
    alter table public.events
      alter column partners set default '[]'::jsonb;
  end if;
end $$;

-- ------------------------------------------ Storage: course media buckets ---
-- Course media lives in Supabase Storage, not in the database, split by media
-- type so each kind of file is served from its own bucket:
--
--   cours-covers -> course thumbnail / cover images (JPEG, downscaled client-side)
--   cours-PDF    -> PDF course materials
--   cours-videos -> video course materials
--   event-covers -> event / publication cover images (admin Events page)
--   university-logo -> the university logo uploaded in Settings > General and
--                       rendered on the login card; only the public URL is
--                       stored in the settings table (key 'logo_url').
--
-- The buckets must exist before uploads succeed; paste this block into the SQL
-- Editor (it is idempotent). The public URL returned by the app embeds the
-- bucket name, so the student course detail renders straight from it.
--
-- 'cours' is the legacy single bucket that still holds the thumbnail_url of
-- every course row saved before the split. Those URLs are absolute and keep
-- working, so the bucket is kept (not dropped) and no row migration is needed.
--
-- Roles: the app has NO Supabase Auth accounts — teachers use the anon/
-- publishable key (cookie sessions), so uploads come in as `anon`.
-- `authenticated` is added too so the buckets keep working if real auth is
-- ever enabled. Policy names must stay unique per role.

insert into storage.buckets (id, name, public)
values
  ('cours', 'cours', true),
  ('cours-covers', 'cours-covers', true),
  ('cours-PDF', 'cours-PDF', true),
  ('cours-videos', 'cours-videos', true),
  ('event-covers', 'event-covers', true),
  ('university-logo', 'university-logo', true)
on conflict (id) do update set public = excluded.public;

-- Policies are generated per bucket so each one is scoped to a single bucket_id.
-- Note 'cours-PDF' keeps its capital P: bucket ids are case-sensitive strings.
do $$
declare
  b text;
begin
  foreach b in array array['cours', 'cours-covers', 'cours-PDF', 'cours-videos', 'event-covers', 'university-logo'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' read anon');
    execute format(
      'create policy %I on storage.objects for select to anon using (bucket_id = %L)',
      b || ' read anon', b);

    execute format('drop policy if exists %I on storage.objects', b || ' read authenticated');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
      b || ' read authenticated', b);

    execute format('drop policy if exists %I on storage.objects', b || ' insert anon');
    execute format(
      'create policy %I on storage.objects for insert to anon with check (bucket_id = %L)',
      b || ' insert anon', b);

    execute format('drop policy if exists %I on storage.objects', b || ' insert authenticated');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)',
      b || ' insert authenticated', b);
  end loop;
end $$;

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
    'students', 'teachers', 'courses', 'publications', 'course_reviews', 'events'
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
    'course_reviews', 'events'
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
