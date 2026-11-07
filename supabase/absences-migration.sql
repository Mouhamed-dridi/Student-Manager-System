-- ---------------------------------------------------------------- absences --
-- Three-target absences on the existing attendance log.
--
-- The Add Absence modal records one of three targets:
--   student    -> an individual student  (user_id = students.id)
--   teacher    -> an individual teacher  (user_id = teachers.id)
--   full_class -> a whole branch/class   (training_id + program_tier)
--
-- Rather than adding a second attendance table, the log gains normalized
-- target columns and keeps its denormalized text columns (full_name, program,
-- training, class_name) so old reads/queries keep working. `type` grows a
-- third allowed value, `full_class`.
--
-- The Add Absence modal also records a time window (time_from/time_to); the
-- legacy `time` column keeps the joined "08:00 - 10:00" display value.
--
-- Idempotent: safe to paste into the Supabase SQL Editor more than once.
-- Until this runs the app's probe reports the columns as missing: individual
-- absences still save through the legacy columns, and full-class absences are
-- refused with a message pointing here.

alter table if exists public.attendance
  add column if not exists target_type text,
  add column if not exists user_id uuid,
  add column if not exists program_tier text,
  add column if not exists training_id uuid,
  add column if not exists absence_date date,
  add column if not exists absence_time text,
  add column if not exists time_from text,
  add column if not exists time_to text;

-- Backfill the normalized columns from the legacy ones (only where empty, so
-- re-running never rewrites a value the app has since stored).
do $$
begin
  if to_regclass('public.attendance') is null then
    return;
  end if;

  update public.attendance set target_type = type where target_type is null;
  update public.attendance set absence_date = date where absence_date is null;
  update public.attendance
     set absence_time = time
   where absence_time is null
     and time is not null;

  -- The absence window: older rows carry one value in `time` ("08:00"), newer
  -- ones a "08:00 - 10:00" text window. Seed Time From / Time To from it once.
  update public.attendance
     set time_from = nullif(trim(split_part(time, ' - ', 1)), ''),
         time_to = nullif(trim(split_part(time, ' - ', 2)), '')
   where time is not null
     and time_from is null;

  alter table public.attendance alter column target_type set default 'student';
end $$;

-- `type` was constrained to student/teacher; allow the full-class target.
-- Any existing check on the type column is dropped first (idempotent).
do $$
declare
  con record;
begin
  if to_regclass('public.attendance') is null then
    return;
  end if;

  for con in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.attendance drop constraint %I', con.conname);
  end loop;
end $$;

alter table if exists public.attendance
  add constraint attendance_type_check
  check (type in ('student', 'teacher', 'full_class'));

create index if not exists attendance_target_idx
  on public.attendance (target_type, training_id);
