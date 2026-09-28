# inti.md — developer instructions

# Purpose: Acts as developer instructions, tech stack configurations, run/test commands, and strict style rules. Why you need it: Automatically loads context every time the AI agent opens your project workspace.

# each time you load or run \init, update this file with what changed in the app

## Tech stack

- React 19 + TypeScript + Vite 8 SPA ("SSM"). No custom backend — data lives in **Supabase** (Postgres + Storage), accessed through the typed client in `src/lib/supabase.ts`.
- Tailwind v4 via `@tailwindcss/vite` — **no tailwind.config.js**; theme tokens/colors live in the `@theme inline` block of `src/index.css`. Edit CSS there.
- shadcn/ui Base UI flavor (`style: base-nova` in `components.json`) — components in `src/components/ui/` wrap `@base-ui/react`, **not Radix**. Add primitives with `npx shadcn add <component>`.
- Icons: lucide-react. Routing: react-router-dom v7. Charts: recharts. Excel: SheetJS (`xlsx`). PDF: jspdf + jspdf-autotable.

## Environment (required)

`.env.local` in the project root (gitignored via `*.local`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...        # or VITE_SUPABASE_PUBLISHABLE_KEY
```

`src/lib/supabase.ts` **throws at import time** if either is missing, so every page fails. Restart Vite after editing env files.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (or `RUN.bat`) |
| Lint | `npm run lint` (oxlint — no ESLint) |
| Typecheck only | `npx tsc -b` |
| Build | `npm run build` (= `tsc -b && vite build`) |
| Probe live DB | `.\check.ps1` (needs `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`) |
| Wipe local state | `.\cleardata.ps1` (localStorage only — session lives in cookies) |

Verification order for every change: `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands. Two oxlint warnings in `src/components/ui/button.tsx` and `tabs.tsx` are pre-existing baseline; ignore them.

## Database (source of truth)

`supabase/schema.sql` is the **executable** source of truth (idempotent — paste it into the Supabase SQL Editor; it is never auto-applied). Tables: `programs`, `trainings`, `students`, `teachers`, `payments`, `attendance`, `courses`, `course_reviews`, `events`, `exams`, `grades`, `publications`, `planning`, `settings`. RLS grants full **anon** access; there are **no Supabase Auth accounts** — "auth" is the cookie scheme below. Storage buckets: `cours`, `cours-covers`, `cours-PDF`, `cours-videos`, `event-covers`.

Before changing a query, confirm the live columns — `schema.sql` can drift from the deployment. Never read `superbase/` (stray folder holding a DB password).

## Strict style rules

- `verbatimModuleSyntax`: types need `import type`.
- `erasableSyntaxOnly`: no enums, namespaces, or parameter properties.
- `noUnusedLocals` / `noUnusedParameters`: zero dead code. `strict` is NOT enabled — don't assume strict null checks.
- Path alias `@/*` → `src/*` (kept in sync in `vite.config.ts`, `tsconfig.app.json` and root `tsconfig.json`).
- **ALL** Supabase I/O goes through `src/lib/api.ts` (~2900 lines). Rows are snake_case; mappers convert to/from the camelCase shapes the UI uses. Add tables/columns/mutations there, never inline in components.
- Rows are UUIDs from Postgres; optional column detection is done once at runtime (`hasColumn`, `detectPaymentsCapabilities`, `generalTrashCapabilities`, `hasCourseMaterialsColumn`) and an absent column must never be referenced — PostgREST rejects unknown columns. The app degrades to an in-memory map and shows a "not available" notice.
- Feature folders: `src/pages/<feature>/` with `<Feature>Page.tsx` + list/form/import subcomponents. Loading/error UI via `src/components/DataState.tsx` (`DataLoading` / `DataError`).
- Sections are NOT routes: they swap via `useState` over `menuItems` + `pages` maps — operator `src/components/Layout.tsx` (menu keys in `src/components/sectionMenu.ts`), student `src/pages/student-portal/StudentLayout.tsx`, teacher `src/pages/teacher-portal/TeacherLayout.tsx`. New section = edit those maps.
- Soft delete everywhere: deletes set `is_deleted = true` + `deleted_at`; every list query filters `.or("is_deleted.is.false,is_deleted.is.null")`.
- Entity IDs come from Postgres; never mint them client-side.

## Data model (Supabase tables)

| Table | Shape / notes | Written by | Read by |
|---|---|---|---|
| `programs` / `trainings` | dropdown source for every form | operator / import | Students, Teachers, Add Absence, courses |
| `students` | `program_id` / `training_id` FKs only (no text) + `password`, `blocked` account columns | Students, User Management, import | teacher/student portals, Pay, Absence, Trash |
| `teachers` | free-text `program` / `training` / `specialty` + `password`, `blocked` | Teachers, User Management, import | Absence, teacher portal, Trash |
| `payments` | `student_id, amount, plan_type, payment_date, status, is_deleted, edit_history` jsonb — names are joined from `students` at read time | PayPage | Payments list, History, My Payment, Trash |
| `attendance` | one denormalised log: `type, full_name, class_name, date, time` + optional `program`/`training` snapshots — no `student_id`, no `present` flag | Absence page / import | Absence, My Absence, Trash |
| `courses` | teacher-owned, `teacher_id` + program/training from `teacherCourseAssignment()`; `thumbnail_url` points at Storage | My Courses | student Courses (merged with static schedule), Planning, Exams, My Class |
| `course_reviews` | star ratings on courses | student portal | course detail |
| `events` | events with covers, partners, date range | Events page | Event History, dashboard |
| `exams` / `grades` | exams snapshotted to `teacher_id` + program/training; grades keyed per exam | Exams, Grades | My Class; grades cascade-deleted with their exam |
| `publications` | announcements | PublicationsPage | student Announcements |
| `planning` | rows filtered strictly by `teacherId` | PlanningPage | Planning |
| `settings` | key/value (`system_name`, `university_name`, `logo_url`, `language`, `dark_mode`) | SettingsPage | everywhere via `getSystemName()` / `applyDarkMode()` |

## Session & auth

- **No Supabase Auth.** Session state is three **cookies** in `src/lib/session.ts`: `role`, `currentStudentId`, `currentTeacherId`. `localStorage` is used only for the `ssm-settings` fallback cache.
- Routes: exactly four in `src/App.tsx` — `/login`, `/dashboard`, `/student`, `/teacher`, with role-aware guards; `/login` and the wildcard bounce by role.
- One login page for all roles (`src/pages/LoginPage.tsx`), checked in order: (1) `admin` / `admin123` → operator; (2) teachers by exact case-sensitive trimmed full name; (3) students by case-insensitive trimmed match. `blocked === true` shows "Access has been blocked by the center."; wrong password always shows the generic "Incorrect name or password."
- Accounts are just `password` / `blocked` columns on the people tables (null password = no account). `src/pages/users/userAccounts.ts` holds `DEFAULT_TEACHER_PASSWORD = "tch123"`, `DEFAULT_STUDENT_PASSWORD = "std123"`.
- `getStudentById` / `getTeacherById` returning null ends the session (each layout has a deleted-record effect).
- Realtime: pages subscribe via `subscribeToTable(table, refetch)`; a table must be in the `supabase_realtime` publication to deliver events. `useRefetchOnFocus` is the fallback.

## Current app state (keep updated)

Implemented end-to-end: single login for all roles; operator dashboard with recharts stats; Students CRUD + Excel import/export; Teachers CRUD + import/export; Payments with receipt printing, per-edit `edit_history` audit trail, History and Trash; single-table Absence log with import/export and program/training reconciliation; Publications; Events (New Event + Event History) with cover uploads; User Management (Students|Teachers: create/block/reset/delete account); shared Trash for students/teachers/publications/attendance; Settings (General|Preferences|System|About) with system name, logo, dark mode and DB reconcile; student portal (Dashboard, Courses + reviews, My Payment, Announcements, My Absence, Settings) merging the static seeded schedule with live `courses`; teacher portal (My Courses, Exams & Notes, Class, Planning) scoped strictly to the teacher's own courses and class.

Known gaps: `MyInfoPage.tsx` exists but is wired into no menu. `check.ps1` does not probe the newer tables (`events`, `course_reviews`, `settings`).
