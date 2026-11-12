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

-- Plan details written by the Add Payment modal (see
-- supabase/payments-plan-migration.sql). Free text, app-constrained.
alter table if exists public.payments
  add column if not exists payment_method text,
  add column if not exists semester text,
  add column if not exists payment_month text,
  add column if not exists student_program text;

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
-- type is 'student', 'teacher' or 'full_class'; class_name holds the
-- program·training for students or the specialty for teachers.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('student', 'teacher', 'full_class')),
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

-- Three-target absences (see supabase/absences-migration.sql): target_type +
-- user_id for an individual, program_tier + training_id for a full class, and
-- the normalized date/time. Optional for the app, which probes for them.
alter table if exists public.attendance
  add column if not exists target_type text,
  add column if not exists user_id uuid,
  add column if not exists program_tier text,
  add column if not exists training_id uuid,
  add column if not exists absence_date date,
  add column if not exists absence_time text,
  add column if not exists time_from text,
  add column if not exists time_to text;

do $$
declare
  con record;
  col record;
begin
  if to_regclass('public.attendance') is null then
    return;
  end if;

  -- `time`, `time_from` and `time_to` are text here, but databases built by an
  -- earlier release carry them as `time`. A `time` column rejects the
  -- "08:00 - 10:00" window (22009) and made these backfills abort, so convert
  -- them once before touching the values.
  for col in
    select attname
      from pg_attribute
     where attrelid = 'public.attendance'::regclass
       and attname in ('time', 'time_from', 'time_to')
       and attnum > 0
       and not attisdropped
       and format_type(atttypid, atttypmod) <> 'text'
  loop
    execute format(
      'alter table public.attendance alter column %I type text using %I::text',
      col.attname, col.attname
    );
  end loop;

  update public.attendance set target_type = type where target_type is null;
  update public.attendance set absence_date = date where absence_date is null;
  update public.attendance
     set absence_time = time::text
   where absence_time is null and time is not null;

  -- Absence window: seed Time From / Time To from the legacy `time` value
  -- (a single "08:00" or an older "08:00 - 10:00" window).
  update public.attendance
     set time_from = nullif(trim(split_part(time::text, ' - ', 1)), ''),
         time_to = nullif(trim(split_part(time::text, ' - ', 2)), '')
   where time is not null and time_from is null;

  alter table public.attendance alter column target_type set default 'student';

  for con in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.attendance drop constraint %I', con.conname);
  end loop;

  alter table public.attendance
    add constraint attendance_type_check
    check (type in ('student', 'teacher', 'full_class'));
end $$;

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

-- ------------------------------------------------------- absence billets ---
-- Printable absence tickets ("billets d'absence"). A billet is a snapshot of
-- the attendance row it was generated from (student, class/branch, subject,
-- teacher, date and time), so the archive keeps showing the ticket that was
-- handed out after the log row changes. `billet_code` is the required unique
-- ticket identifier and `verification_code` is the code printed on the sheet;
-- the app writes the same value into both. Column names mirror the live table
-- and the patch in supabase/absence-billets-migration.sql, which additionally
-- backfills the older `code` / `program` / `training` / `course` revision.

create table if not exists public.absence_billets (
  id uuid primary key default gen_random_uuid(),
  -- No FK: the log row may be purged while the ticket is still archived.
  attendance_id uuid,
  -- students.id for an individual target, null for a class-wide absence.
  student_id uuid,
  student_name text not null,
  class_name text,
  -- Legacy display columns kept for older rows; the app does not write them.
  class_branch text,
  course_name text,
  subject text,
  teacher_name text,
  absence_date date not null,
  -- Display window ("08:00 - 10:00"); `absence_time` is the legacy twin.
  time_slot text,
  absence_time text,
  verification_code text,
  billet_code text not null unique,
  created_at timestamptz not null default now()
);

-- Databases created before these columns existed skip the create above, so add
-- them explicitly (same drift rule as the other tables in this file).
alter table if exists public.absence_billets
  add column if not exists student_id uuid,
  add column if not exists class_branch text,
  add column if not exists course_name text,
  add column if not exists subject text,
  add column if not exists teacher_name text,
  add column if not exists absence_date date,
  add column if not exists time_slot text,
  add column if not exists verification_code text,
  add column if not exists billet_code text;

create index if not exists absence_billets_created_idx
  on public.absence_billets (created_at desc);

create index if not exists absence_billets_student_idx
  on public.absence_billets (student_name);

create unique index if not exists absence_billets_billet_code_key
  on public.absence_billets (billet_code);

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

-- Teacher RSVPs ("Join" in the teacher portal). Deliberately NOT folded into
-- `members`, which is student ids: a teacher is neither an organizer nor a
-- student, and reusing `members` would make the operator's Event History
-- tooltip resolve every attendee as "Unknown". No FK and no stored name, for
-- the same reason as the other id columns above — people are soft-deleted, so a
-- stale id is simply skipped at read time.
--
-- Added as a separate `alter table` because `create table if not exists` above is
-- a no-op on an already-deployed table and would never add the column. Keep it
-- OUT of the saveEvent() payload: the operator's edit form must not overwrite
-- the RSVPs it was never asked about.
alter table public.events
  add column if not exists attendees uuid[] not null default '{}';

-- Optional venue / Google Maps link from the event creator's Location field.
-- Free text (a maps.app.goo.gl URL or a plain room/address); existing rows stay
-- NULL. The app probes the column (hasEventsLocationColumn()) and skips it on
-- write when absent. Mirrored by supabase/events-location-migration.sql.
alter table public.events
  add column if not exists location text;

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
--   exam         -> PDF attachments for exams (teacher Exams & Notes page);
--                       exams.attachment_url stores the public URL.
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
  ('university-logo', 'university-logo', true),
  ('exam', 'exam', true)
on conflict (id) do update set public = excluded.public;

-- Policies are generated per bucket so each one is scoped to a single bucket_id.
-- Note 'cours-PDF' keeps its capital P: bucket ids are case-sensitive strings.
do $$
declare
  b text;
begin
  foreach b in array array['cours', 'cours-covers', 'cours-PDF', 'cours-videos', 'event-covers', 'university-logo', 'exam'] loop
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
-- Owned by the teacher who created them. `program`/`training` are legacy
-- snapshots kept for old rows; exams are identified by type + duration now.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid,
  program text,
  training text,
  title text not null,
  date date,
  type text,
  duration text,
  semester text,
  course text,
  file_name text,
  attachment_url text,
  created_at timestamptz not null default now()
);

-- Exam attachments and the semester were added after the table shipped: keep
-- existing live databases in sync (CREATE TABLE IF NOT EXISTS will not add
-- the columns). `semester` is plain text ('Semester 1' | 'Semester 2').
alter table public.exams
  add column if not exists attachment_url text,
  add column if not exists semester text;

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
    created_at timestamptz not null default now(),
    type text not null default 'info' check (type in ('urgent','warning','info'))
  );

-- ---------------------------------------------------------------- planning -
-- Lesson log: one entry per session; 'topic' holds what was covered.
-- class_name is the group/section the session was taught to, session_time the
-- display window ("08:30 - 10:00"), and session_type the kind of session.
-- program_id/training_id are the stable class scope the student portal filters
-- on; class_name is kept as the display label (and as a fallback for rows
-- written before the columns existed).

create table if not exists public.planning (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid,
  date date not null,
  course text,
  topic text,
  class_name text,
  session_time text,
  session_type text not null default 'In-class'
    constraint planning_session_type_check
    check (
      session_type in (
        'In-class', 'Online',
        'DS', 'TP', 'TD', 'Principale', 'Exam', 'SYNTHESE',
        'PFE', 'Soutenance'
      )
    ),
  -- Room / classroom the session meets in ("ClassB1", "AC11"). Free text:
  -- rooms are not a table in this app, and the operator's Planification grid
  -- only badges it.
  room_name text,
  program_id uuid references public.programs(id),
  training_id uuid references public.trainings(id),
  -- Optional internal note, shown only in the operator's session editor.
  notes text,
  -- Jury committee of a PFE/STAGE/Soutenance session. teacher_id stays the
  -- session's lead teacher; this array adds the panel (supervisor, president,
  -- examiner). NULL on every other session kind.
  jury_teacher_ids uuid[],
  created_at timestamptz not null default now()
);

-- Idempotent for databases whose planning table already exists.
alter table if exists public.planning
  add column if not exists program_id uuid references public.programs(id),
  add column if not exists training_id uuid references public.trainings(id),
  add column if not exists room_name text,
  add column if not exists notes text,
  add column if not exists jury_teacher_ids uuid[];

-- An older planning table was constrained to the four original session types,
-- which refuses the exam (DS, TP, TD, Principale, SYNTHESE) and PFE kinds.
-- Rebuilt unconditionally: dropping and re-adding is idempotent.
alter table if exists public.planning
  drop constraint if exists planning_session_type_check;
alter table if exists public.planning
  add constraint planning_session_type_check
  check (
    session_type in (
      'In-class', 'Online',
      'DS', 'TP', 'TD', 'Principale', 'Exam', 'SYNTHESE',
      'PFE', 'STAGE', 'Soutenance'
    )
  );

create index if not exists planning_program_training_idx
  on public.planning (program_id, training_id);

-- --------------------------------------------------------------------- QCM --
-- Teacher-authored multiple-choice quizzes. `questions` is jsonb holding an
-- array of {id, text, options[], correctIndex}; the app normalises it through
-- toQuizQuestions() because older jsonb columns in this schema have been seen
-- double-encoded as a JSON string by PostgREST.
--
-- `teacher_id` scopes every read/write: a teacher only ever sees their own
-- quizzes. `course_id` is the target class and deliberately nullable so a quiz
-- can outlive the course it was built for; the title is resolved from
-- listTeacherCourses() at read time and shows "Unassigned course" when the
-- course is gone. No FK to teachers/courses, matching the rest of the schema:
-- both are soft-deleted, and a cascade would take the quiz with them.
--
-- Soft delete matches the rest of the app: is_deleted/deleted_at, and every
-- read filters `.or("is_deleted.is.false,is_deleted.is.null")`.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null,
  description text,
  course_id uuid,
  questions jsonb not null default '[]'::jsonb,
  -- Drafts are editable; publishing flips this. The teacher portal has no
  -- separate publish endpoint — saving with is_published set is the publish.
  is_published boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_teacher_idx
  on public.quizzes (teacher_id, created_at desc);

-- One submission per student per quiz: the unique index is what makes a
-- re-submit an upsert instead of a duplicate row.
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  student_id uuid not null,
  -- {questionId: selectedOptionIndex}
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists quiz_responses_quiz_student_idx
  on public.quiz_responses (quiz_id, student_id);

create index if not exists quiz_responses_quiz_idx
  on public.quiz_responses (quiz_id);

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
    'students', 'teachers', 'courses', 'publications', 'course_reviews', 'events',
    'quizzes', 'quiz_responses'
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
    'course_reviews', 'events', 'quizzes', 'quiz_responses',
    'absence_billets'
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
