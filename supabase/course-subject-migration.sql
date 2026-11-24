-- ============================================================================
-- SSM — Courses: the material (matière) a course belongs to
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: safe to run more than once.
--
-- `courses.title` is the course name (e.g. "Implementing an SAP Solution"),
-- NOT the subject it is taught under. The student Cours filter lists the
-- class's materials from `branch_materials` (or the planification) and filters
-- courses by this column, so a teacher course must name its material here.
-- Legacy rows keep NULL and are attributed to their teacher's material when
-- that teacher is assigned exactly one material in the class.
-- ============================================================================

alter table if exists public.courses
  add column if not exists subject text;
