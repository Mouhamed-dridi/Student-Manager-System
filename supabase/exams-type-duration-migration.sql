-- Exams: replace the "Course" field with "Type" and add "Duration".
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- The legacy `course` column is kept (old rows may still hold course names);
-- the app no longer reads or writes it.

alter table public.exams
  add column if not exists type text,
  add column if not exists duration text;
