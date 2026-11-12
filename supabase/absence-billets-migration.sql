-- ---------------------------------------------------------- absence billets --
-- Archive of generated student absence tickets ("billets d'absence").
--
-- A billet is a printable snapshot: the student, the class/branch, the subject
-- and the teacher are copied in at generation time instead of being joined back
-- through `attendance` and `planning`, which can be edited, trashed or purged
-- afterwards. `billet_code` is the required unique ticket identifier and
-- `verification_code` is the code printed on the sheet — the app writes the
-- same generated value into both.
--
-- The column names below mirror the live project table, which is the source of
-- truth: `class_name`, `subject`, `teacher_name`, `time_slot`,
-- `verification_code`, `billet_code`. The pre-`subject` revision of this file
-- used `program`/`training`/`course`/`code`; those columns are left in place on
-- upgraded databases (nullable, no longer written) and `code` is backfilled into
-- both new code columns below.
--
-- Idempotent: safe to paste into the Supabase SQL Editor more than once.
-- Until this runs the Billets page shows an empty archive and generating a
-- billet fails with a message pointing here.

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

-- Databases created from the older revision of this file already have the
-- table, so the create above is skipped; add the live columns one by one.
-- `absence_date` / `billet_code` start nullable here and are tightened after
-- the backfill below.
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

do $$
begin
  -- Old rows kept the printable code in `code`: carry it into both code
  -- columns, then stop requiring it since the app no longer writes it.
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'absence_billets'
       and column_name = 'code'
  ) then
    execute $sql$
      update public.absence_billets
         set verification_code = coalesce(verification_code, code),
             billet_code = coalesce(billet_code, code)
       where code is not null
         and (verification_code is null or billet_code is null)
    $sql$;
    execute 'alter table public.absence_billets alter column code drop not null';
  end if;

  -- Tickets issued before `absence_date` existed fall back to the issue day.
  execute $sql$
    update public.absence_billets
       set absence_date = coalesce(absence_date, created_at::date)
     where absence_date is null
  $sql$;

  -- A ticket with no code at all cannot be verified or reprinted by code:
  -- derive one from the row id so the column can be made required.
  execute $sql$
    update public.absence_billets
       set billet_code =
             'BIL-' || to_char(coalesce(absence_date, created_at), 'YYYYMMDD')
               || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
     where billet_code is null
  $sql$;

  -- Second pass: every archived ticket must be printable by its code, so rows
  -- that only have one of the two code columns inherit the other. This runs
  -- after the derivation above because SET expressions read the OLD row.
  execute $sql$
    update public.absence_billets
       set verification_code = billet_code
     where verification_code is null
  $sql$;
end $$;

alter table if exists public.absence_billets
  alter column absence_date set not null,
  alter column billet_code set not null;

-- The archive always reads newest first, searches by student name, and looks a
-- ticket up by its unique code. On a fresh database `billet_code` declared
-- `unique` already created an index with this name, so it is skipped.
create index if not exists absence_billets_created_idx
  on public.absence_billets (created_at desc);

create index if not exists absence_billets_student_idx
  on public.absence_billets (student_name);

create unique index if not exists absence_billets_billet_code_key
  on public.absence_billets (billet_code);

-- Same policy model as every other table: no Supabase Auth, one shared anon
-- key, so RLS grants full access and is not an authorization boundary.
alter table public.absence_billets enable row level security;

do $$
begin
  begin
    create policy absence_billets_anon_all on public.absence_billets
      for all to anon using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
