# Planning Session Type Design

## Intent

Let teachers classify each planning entry as In-class, Online, Exam, or Soutenance, and show that type consistently in teacher and student planning views.

## Goals and non-goals

- Add a `planning.session_type` text column, defaulting existing and new rows to `In-class`, constrained to the four supported values.
- Add a Session Type selector below Course in the planning entry form and save it on create and edit.
- Show a small monochrome session-type badge on teacher calendar cards and list entries, and on student planning session cards.
- Do not add a separate `PlanningEntryModal.tsx`; the form is currently `EntryForm` embedded in `src/pages/teacher-portal/PlanningPage.tsx`.
- Do not change planning filters, exports, or unrelated exam behavior.

## Approaches

- **Postgres enum:** strict storage type, but changing available values later requires enum migrations and corresponding client updates.
- **Text with CHECK:** selected; straightforward to migrate and extend while still restricting stored values to the supported options.

## Constraints and implementation calls

- The live `planning` table has `class_name` and `session_time`, but no `session_type`.
- Use an idempotent SQL migration for existing databases and update `supabase/schema.sql` for fresh databases.
- Follow the existing optional-column capability-probe pattern in `src/lib/api.ts`; fail writes with an actionable migration message when the column is missing.
- Represent the value in the shared `PlanningRecord`, mapping older rows to `In-class`.
- Use the exact values `In-class`, `Online`, `Exam`, and `Soutenance`; default new form entries to `In-class`.
- Display the badge in the teacher's calendar cards and linear list/day-entry list, and in the student's planning cards.
- Apply the SQL migration manually in Supabase SQL Editor; it is not automatically applied by the app.
