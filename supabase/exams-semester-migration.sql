-- Exams: add the "Semester" field ("Semester 1" | "Semester 2").
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- Plain text on purpose: the app's SEMESTER_OPTIONS list is the only limit,
-- exactly like events.type. No CHECK constraint, so old rows with other
-- values do not block the migration.

alter table public.exams
  add column if not exists semester text;
