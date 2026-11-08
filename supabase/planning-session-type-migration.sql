-- Planning: classify each session as a timetable, exam or PFE session.
--
--   Emploi du temps   -> In-class, Online
--   Emploi des examens -> DS, TP, TD, Principale, Exam, SYNTHESE
--   Planning PFE      -> PFE, STAGE, Soutenance
--
-- Existing rows receive the default ('In-class') when the column is added, and
-- the check is rebuilt unconditionally so a database created with the original
-- four-value constraint learns the new kinds too. Idempotent — safe to run more
-- than once. Paste into the Supabase SQL Editor.

alter table public.planning
  add column if not exists session_type text not null default 'In-class';

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
