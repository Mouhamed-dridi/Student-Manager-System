-- ============================================================================
-- qcm-migration.sql — bring the live quizzes/quiz_responses tables in line
-- with the QCM block in schema.sql
--
-- WHY THIS FILE EXISTS
--   The live `quizzes` / `quiz_responses` tables were created without the
--   columns and policies the app needs. Verified against the deployed project
--   (PostgREST column probe + insert probe):
--
--     quizzes          has: id, teacher_id, title, description, questions,
--                           is_published, created_at
--                    MISSING: course_id, is_deleted, deleted_at, updated_at
--
--     quiz_responses   has: id, quiz_id, answers, score
--                    MISSING: student_id, created_at
--
--     anon INSERT      on quizzes is rejected: 42501 "new row violates row
--                      level security policy" — the `_anon_all` policy was
--                      never created for these two tables.
--
--   `student_id` is not a nicety: without it a response cannot be attributed
--   to anyone, so the review panel can only ever say "Removed student". That
--   is a schema bug, not something the app should code around.
--
-- HOW TO APPLY
--   Paste this whole file into the Supabase SQL Editor and run it. It is
--   idempotent, so re-running is safe. The tables are empty (0 rows), so
--   nothing is rewritten.
-- ============================================================================

-- --- quizzes: missing columns -----------------------------------------------
-- Target class for the quiz. Nullable so a quiz can outlive its course; the
-- title is resolved from listTeacherCourses() at read time.
alter table public.quizzes
  add column if not exists course_id uuid;

-- Soft delete, matching students/teachers/payments/publications/attendance.
alter table public.quizzes
  add column if not exists is_deleted boolean not null default false;
alter table public.quizzes
  add column if not exists deleted_at timestamptz;

-- Bumped by every saveQuiz()/setQuizPublished() so the list can sort by it.
alter table public.quizzes
  add column if not exists updated_at timestamptz not null default now();

-- Backfill updated_at for rows written before the column existed.
update public.quizzes set updated_at = created_at where updated_at > created_at;

-- --- quiz_responses: missing columns ----------------------------------------
-- Who submitted. The unique index below is what makes a re-submit an upsert
-- rather than a duplicate row, so it can only be created once this exists.
alter table public.quiz_responses
  add column if not exists student_id uuid;
alter table public.quiz_responses
  add column if not exists created_at timestamptz not null default now();

-- Drop the plain non-unique index if an earlier run created it, then make the
-- (quiz_id, student_id) pair genuinely unique.
drop index if exists public.quiz_responses_quiz_student_idx;
create unique index if not exists quiz_responses_quiz_student_idx
  on public.quiz_responses (quiz_id, student_id);

create index if not exists quiz_responses_quiz_idx
  on public.quiz_responses (quiz_id);

-- --- RLS: the policies that were never created -------------------------------
-- The app has no Supabase Auth accounts; every request arrives on the same
-- publishable/anon key, so these are full-access policies, exactly like the
-- loop at the bottom of schema.sql.
alter table public.quizzes enable row level security;
alter table public.quiz_responses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quizzes'
      and policyname = 'quizzes_anon_all'
  ) then
    create policy quizzes_anon_all on public.quizzes
      for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quiz_responses'
      and policyname = 'quiz_responses_anon_all'
  ) then
    create policy quiz_responses_anon_all on public.quiz_responses
      for all to anon using (true) with check (true);
  end if;
end $$;

-- --- Realtime ---------------------------------------------------------------
-- subscribeToTable() only fires for tables in the publication.
do $$
declare
  t text;
begin
  foreach t in array array['quizzes', 'quiz_responses']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
