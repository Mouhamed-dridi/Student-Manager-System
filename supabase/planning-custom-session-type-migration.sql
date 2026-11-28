-- Planning: exam kinds typed by the teacher.
--
-- The entry form's "Planification d'examen" tab offers the fixed exam kinds
-- (TD, TP, Principale, DS, Exam, SYNTHESE) plus an "Other / Text" option. The
-- fixed kind stays in `session_type` so the row still classifies as an exam in
-- the operator tabs, the schedule and the badges, and the free-text kind the
-- teacher typed ("Rattrapage", "Contrôle continu"…) is stored here instead of
-- loosening the `planning_session_type_check` constraint.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.

alter table public.planning
  add column if not exists custom_session_type text;
