-- Exams: backfill the class snapshot (program + training) on rows created
-- before CreateExamView started stamping it.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- Why this is needed: `exams` has no program_id. The student portal filters
-- exams in the database with
--   .eq("program", students->programs.code).eq("training", trainings.name)
-- and every pre-existing exam row carries program = training = '', so those
-- exams are invisible to every student until this runs. New exams are stamped
-- by the teacher Create Exam form, so only legacy rows need this.
--
-- Source of truth is `courses`, not `teachers`: teachers.program/training are
-- NULL on live data. Each exam is matched to its own teacher's most recently
-- published course that actually has a program and a training.
--
-- `program` receives programs.code ("BTS"), matching students.program.
-- `training` receives trainings.name ("Réseaux et sécurité informatique"),
-- matching students.training.

with class_of_teacher as (
  select distinct on (c.teacher_id)
    c.teacher_id,
    p.code as program,
    t.name as training
  from public.courses c
  join public.programs p on p.id = c.program_id
  join public.trainings t on t.id = c.training_id
  where c.teacher_id is not null
  order by c.teacher_id, c.published_at desc nulls last
)
update public.exams e
set program = c.program,
    training = c.training
from class_of_teacher c
where c.teacher_id = e.teacher_id
  and coalesce(btrim(e.program), '') = ''
  and coalesce(btrim(e.training), '') = '';

-- Verify (should list no exam that a student of that class cannot see):
--   select e.id, e.title, e.date, e.teacher_id, e.program, e.training
--   from public.exams e
--   order by e.date desc;
--
-- Rows whose teacher has no course with a program/training stay blank and
-- remain hidden from students: assign that teacher a course (or a class
-- profile) and either rerun this file or edit the exam in the teacher portal.
