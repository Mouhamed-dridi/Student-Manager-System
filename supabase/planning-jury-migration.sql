-- Planning PFE: the jury committee of a defence / internship session.
--
-- `planning.teacher_id` stays the session's lead teacher — the row still shows
-- up on that teacher's own planning, exactly like a lesson — while
-- `jury_teacher_ids` lists the rest of the panel (supervisor, president,
-- examiner). The operator's Planning PFE dialog writes both, and the branch
-- grid badges the resolved names ("Jury: Mr. Ben Ali, Mrs. Trabelsi").
--
-- This file also teaches the session-type check about 'STAGE', the internship
-- sitting that belongs to the Planning PFE tab.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
-- The app probes for the column (`hasPlanningJuryTeacherIds()` in
-- src/lib/api.ts) and refuses a PFE save that carries a jury until it exists;
-- reads of a database without it just see no jury.

alter table public.planning
  add column if not exists jury_teacher_ids uuid[];

alter table public.planning
  drop constraint if exists planning_session_type_check;

alter table public.planning
  add constraint planning_session_type_check
  check (
    session_type in (
      'In-class', 'Online',
      'DS', 'TP', 'TD', 'Principale', 'Exam', 'SYNTHESE',
      'PFE', 'STAGE', 'Soutenance'
    )
  );

-- The existing planning_anon_all policy from schema.sql covers the new column;
-- no policy change is needed (the app has no Supabase Auth, so RLS cannot
-- scope rows per role).
