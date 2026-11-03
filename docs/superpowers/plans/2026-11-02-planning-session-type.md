# Planning Session Type Implementation Plan

> **For agentic workers:** Implement this plan task-by-task in the current session; do not delegate this small, coupled change.

**Goal:** Add a persisted session type to teacher planning entries and display it in teacher and student planning views.

**Architecture:** Add a text column constrained to the four supported values, with a default that backfills existing rows. Extend the shared planning record and API writes using the current runtime schema-probe pattern, then reuse one badge component in both portals.

**Tech Stack:** React 19, TypeScript, Supabase JS/Postgres, existing Tailwind/shadcn styles, oxlint, TypeScript build.

**Spec:** `docs/superpowers/specs/2026-11-02-planning-session-type-design.md`

## Global Constraints

- Use the exact values `In-class`, `Online`, `Exam`, and `Soutenance`; default new form entries to `In-class`.
- The live `planning` table has `class_name` and `session_time`, but no `session_type`.
- Use an idempotent SQL migration for existing databases and update `supabase/schema.sql` for fresh databases.
- Follow the existing optional-column capability-probe pattern in `src/lib/api.ts`; fail writes with an actionable migration message when the column is missing.
- Apply the SQL migration manually in Supabase SQL Editor; it is not automatically applied by the app.

## Review Focus

- **Existing rows after migration:** expect `In-class` through the database default (Task 1).
- **Database without the migration:** expect writes to fail with the migration filename, not a raw PostgREST error (Task 1).
- **Legacy reads:** a row with no session type maps to `In-class` (Task 1).
- **Editing an entry:** changing its session type persists the selected value (Task 2).
- **Portal consistency:** each supported value has a monochrome badge on teacher calendar/list/day items and student session cards (Task 3).

---

### Task 1: Add schema support and extend the planning API

**Files:**
- Create: `supabase/planning-session-type-migration.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/pages/teacher-portal/planning.ts`
- Modify: `src/lib/api.ts`

**Interfaces:**
- Produces: `PlanningSessionType = "In-class" | "Online" | "Exam" | "Soutenance"` and required `PlanningRecord.sessionType`.
- Produces: a migration that adds `planning.session_type text not null default 'In-class'` and an idempotently-created CHECK constraint for the four supported values.

- [ ] Add `session_type` with a default and CHECK constraint to the fresh `planning` table definition.
- [ ] Create an idempotent migration that adds the column/default and safely adds `planning_session_type_check` if it is absent.
- [ ] Add `PLANNING_SESSION_TYPES` and `PlanningSessionType` to `src/pages/teacher-portal/planning.ts`; add `sessionType` to `PlanningRecord`.
- [ ] Extend `PlanningRow` and `planningFromRow()` so null/legacy values map to `In-class`.
- [ ] Add cached `hasPlanningSessionTypeColumn()` probing and `PLANNING_SESSION_TYPE_MISSING` with the exact migration path.
- [ ] Require the column in `insertPlanning()` and `updatePlanning()`, and write `session_type` in both mutation payloads.

### Task 2: Add the Session Type selector and persist selection

**Files:**
- Modify: `src/pages/teacher-portal/PlanningPage.tsx`

**Interfaces:**
- Consumes: `PLANNING_SESSION_TYPES`, `PlanningSessionType`, and `PlanningRecord.sessionType` from Task 1.
- Produces: `EntryFormValues.sessionType` passed to both `insertPlanning()` and `updatePlanning()`.

- [ ] Add a Session Type select immediately below Course, using the four exact labels and defaulting new entries to `In-class`.
- [ ] Initialize edited entries from `initial.sessionType` and include the selected `sessionType` in form submission values.
- [ ] Verify create and edit handlers pass the field through to their existing API mutations.

### Task 3: Display shared monochrome badges

**Files:**
- Create: `src/components/PlanningSessionTypeBadge.tsx`
- Modify: `src/pages/teacher-portal/PlanningPage.tsx`
- Modify: `src/pages/student-portal/StudentPlanningPage.tsx`

**Interfaces:**
- Consumes: `PlanningSessionType` from `src/pages/teacher-portal/planning.ts`.
- Produces: a reusable badge accepting `{ sessionType: PlanningSessionType }`.

- [ ] Render the shared badge on teacher calendar cards, linear-list entries, and the day-dialog entry list.
- [ ] Render the same badge on student planning session cards.
- [ ] Keep the badge monochrome and visually subordinate to course/title content.

### Task 4: Validate

**Files:**
- No additional files.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: checked type safety, lint, and database migration instructions.

- [ ] Run `npm run lint`; expect no new errors and preserve the two known baseline warnings.
- [ ] Run `npx tsc -b`; expect success.
- [ ] After the user applies `supabase/planning-session-type-migration.sql` in Supabase SQL Editor, verify one new entry and one edited entry retain their chosen types, and old entries read as `In-class`.
- [ ] Verify badges are visible in teacher grid/list/day views and student planning cards.
