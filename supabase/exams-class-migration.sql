-- Exams: add the class / branch scope written by the teacher Create Exam
-- class picker. Idempotent — safe to run more than once. Paste into the
-- Supabase SQL Editor.
--
-- Why: a teacher staffed in several branches (Lobna Ouertani teaches
-- "ERP Consulting" in CAP, BTP and BTS) must be able to say which class an exam
-- belongs to. The app already snapshots the class as text — `program` receives
-- programs.code ("CAP"/"BTP"/"BTS") and `training` receives trainings.name —
-- and that is what the student portal filters on. These columns add the
-- explicit ids (so a renamed training still resolves) and the matière tag (so
-- the student MATIÈRES filter can list "ERP Consulting").
--
-- All four columns are optional to the app: it probes them at runtime and only
-- writes them when they exist, so exam creation keeps working before this runs.
-- No foreign keys on purpose: an exam is a snapshot, and deleting a branch or
-- training must not delete or block the exams already handed out.

alter table public.exams
  add column if not exists branch_id uuid,
  add column if not exists program_id uuid,
  add column if not exists training_id uuid,
  add column if not exists subject text;

-- Verify:
--   select id, title, program, training, branch_id, training_id, subject
--   from public.exams
--   order by date desc;
