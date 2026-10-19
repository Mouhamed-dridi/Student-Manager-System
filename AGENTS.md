# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM"), backed by Supabase. No tests, no CI, no ESLint. Env files are gitignored (`*.local`).

## Setup & Commands

- **Dev**: `npm run dev` (or `RUN.bat`). No port pinned in `vite.config.ts`; `cleardata.ps1` assumes `http://localhost:5173`.
- **Lint**: `npm run lint` (oxlint, `.oxlintrc.json`). Baseline: 2 warnings (`react/only-export-components` in `src/components/ui/button.tsx`, `tabs.tsx`) — do not fix them.
- **Typecheck**: `npx tsc -b`. **Build**: `tsc -b && vite build`. No test or `typecheck` npm script; do not invent them.
- **Verify changes**: run `npm run lint` then `npx tsc -b` (in that order).
- **Live Supabase checks**: `.\check.ps1` (connectivity, table existence/anon read, row counts, QCM columns). Requires `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (does **not** accept `VITE_SUPABASE_ANON_KEY` here). Optional `SUPABASE_SECRET_KEY` enables a secret-key check.
- **QCM probe**: `.\probe-qcm.ps1` (focused column + insert probes).
- **Clear local state**: `.\cleardata.ps1` only clears `localStorage` via CDP; session is in cookies (does not log you out).
- **Schema verification**: Before changing Supabase-querying code, confirm live columns (schema drifts). Use OpenCode command `.opencode/command/verify-fix.md` or ask the user — never guess.

## Environment & Backend

- **Supabase required**: `.env.local` needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` **or** `VITE_SUPABASE_PUBLISHABLE_KEY`; the PowerShell scripts only read the publishable name. `src/lib/supabase.ts` throws at import if missing; restart Vite after env changes. `.env.example` documents both key formats.
- **Schema is not auto-applied**: `supabase/schema.sql` is the executable source of truth (idempotent). Paste into Supabase SQL Editor to create/update; `CREATE TABLE IF NOT EXISTS` will **not** add missing columns to existing tables. For QCM column gaps on live tables, run `supabase/qcm-migration.sql` (idempotent) instead.
- **Single data layer**: ALL Supabase I/O goes through `src/lib/api.ts` (~3600 lines). Rows are `snake_case`; mappers convert to `camelCase`. Add new tables/columns/mutations there — never inline in components.
- **Capability probing (critical)**: optional schema detected once at runtime; never reference a column that may not exist (PostgREST rejects unknown columns). App degrades gracefully. Key helpers: `detectPaymentsCapabilities()` (payments `is_deleted/deleted_at/edit_history`), `generalTrashCapabilities()` (soft-delete flags on students/teachers/publications/attendance), `hasCourseMaterialsColumn()` (courses.materials), `hasEventsTable()`, `hasQuizzesTable()`. `check.ps1` probes QCM columns because live quizzes/quiz_responses often lack `course_id`, `is_deleted/deleted_at`, `updated_at`, `student_id` + RLS policies.
- **Storage buckets (case-sensitive)**: per media type via `src/lib/courseBuckets.ts` (single source of truth for upload/display paths): `cours-covers`, `cours-PDF`, `cours-videos`, `event-covers`, `university-logo`. Legacy `cours` bucket holds older absolute `thumbnail_url`s (kept). Buckets + anon policies are in `schema.sql`'s Storage block.
- **Realtime**: `subscribeToTable(table, () => refetch())` on live pages; `useRefetchOnFocus(refetch)` does one refetch on tab regain (≥5s hidden). Realtime publication (from schema bottom) includes: `students, teachers, courses, publications, course_reviews, events, quizzes, quiz_responses` — **not** attendance or payments.
- **Session**: cookies via `src/lib/session.ts` (`role`, `currentStudentId`, `currentTeacherId`). `localStorage` only for `ssm-settings` fallback cache. Guards in `src/App.tsx`; deleted records end session.

## Architecture

- **Routes (4)**: `/login`, `/dashboard` (operator), `/student`, `/teacher`. Role guards; wildcard bounces by role. `/dashboard` renders `<Layout />`; real stats are in `src/pages/dashboard/DashboardPage.tsx`.
- **Sections = state, not routes**: each layout swaps sections via `useState` + `pages` map. When adding a section, update **both** the menu list and the `pages` record.
  - **Operator**: menu in `src/components/sectionMenu.ts` (typed `MenuKey`), `pages` map/render in `src/components/Layout.tsx`. Pay and Events are collapsible parents (parent highlights via first child key). `publications` (create broadcast) and `news-center` (`publications/NewsCenterPage.tsx`, edit/soft-delete) both read the same `publications` table.
  - **Teacher**: `teacher-portal/TeacherLayout.tsx` builds its `pages` map **inside the component** (closes over `setOpenEventId`) — event detail swaps in as full page (not route). `QcmPage` owns its own `editing` state. Sidebar has one collapsible parent, `"Exams"` (children `exams-notes`, `qcm`); the parent key is separate from page keys, so the page union `PageKey` excludes it and `openSections` holds toggle state.
  - **Student**: `student-portal/StudentLayout.tsx` (menu + pages), including a `qcm` section (`StudentQcmPage.tsx`) for taking published quizzes. `MyInfoPage.tsx` exists but not in menu. Settings differ: operator `settings/SettingsPage.tsx` vs student `student-portal/StudentSettingsPage.tsx`.
- **Login**: single form (`src/pages/LoginPage.tsx`) checks (1) `admin`/`admin123` → operator, (2) teachers by **exact case-sensitive** trimmed full name, (3) students by **case-insensitive** trimmed match. `blocked` checked only after credentials match; wrong password → generic message.
- **Branding**: bootstrap in `main.tsx` fetches settings once via `src/lib/branding.ts` (`useBranding`, `brandTitle`, `setBrandingFromSettings()`), cached for layouts/Login. `system_name` falls back to "SSM".
- **Accounts**: `password`/`blocked` columns on people tables (null password = no account). Defaults: `tch123`/`std123` in `src/pages/users/userAccounts.ts` (`DEFAULT_TEACHER_PASSWORD`, `DEFAULT_STUDENT_PASSWORD`).

## Data-model Gotchas (must know)

- **Programs/trainings — two sources**: DB tables `programs`/`trainings` drive all form dropdowns + `resolveProgramTrainingIds()` (student inserts); empty tables silently drop program/training. Static `PROGRAMS`/`TRAININGS`/`COURSES` in `src/lib/trainings.ts` only power student portal seeded schedule. `students` store only `program_id`/`training_id` FKs; `teachers` use free-text `program`/`training`/`specialty`.
- **Class assignment uses specialty aliases**: `teacherCourseAssignment()` resolves profile first, then `teachers.specialty` via hand-maintained `SPECIALTY_CLASS_ALIASES` in `api.ts` (aliases normalized by `normalizeSpecialtyKey()` where `&`→space), then teacher's courses. Targets are `"CODE / Name"` (avoid ambiguous bare names across programs). No FK; mismatches show amber banner on Class page. `supabase/backfill-teacher-classes.sql` is optional, idempotent, but flags 2 ambiguous rows — don't run blindly.
- **Soft delete everywhere**: `is_deleted=true` + `deleted_at`; list queries filter `.or("is_deleted.is.false,is_deleted.is.null")`. Trashed people cannot log in and their session ends (`getStudentById`/`getTeacherById` returns null). Payments have their own trash; students/teachers/publications/attendance share `GeneralTrashPage`. Never cascade/hard-delete people-linked rows.
- **Denormalized names**: `attendance`, `course_reviews` (snapshot `student_name`), `events` (`organizers`/`members` as `uuid[]`, no stored names) — resolve at read time and skip missing ids.
- **Courses**: `listTeacherCourses({ teacherId?, programId?, trainingId? })` — pass `{ teacherId }` for teacher-scoped contexts; `{}` only when fetching all. Add Course has **no** program/training selectors (inferred via `teacherCourseAssignment()`, refetched at save). `saveTeacherCourse()` throws on failure; `deleteTeacherCourse()` returns boolean. Thumbnails downscaled to ≤400px JPEG → `cours-covers` (DB stores absolute `thumbnail_url`). `published` = auto `published_at` (displayed as "Added <date>"). `day`/`time_slot` exist but not written.
  - `courses.materials` may be a **JSON string** on older rows (PostgREST/jsonb quirk) — always use `toMaterialList()`; also `toSkillList()` for `skills`. Wrap student detail sections in `ErrorBoundary`.
  - `courses.level/format/duration` are display strings, `skills` is `text[]` (not jsonb) — do not "normalize" without migrating.
  - Thumbnails: Storage wins → training slug image `src/assets/img/courses/<slug>.jpg` (accents/apostrophes → `-`) → gray placeholder.
- **Student courses merge**: static `COURSES` (seeded schedule, no id/teacherId) + live `courses` for student's class via `listTeacherCourses({ programId, trainingId })`, else client-side name fallback. Many trainings have no seeded courses.
- **Events vs Publications**: different tables. `events` = rich items created on the admin Events page; `events.type` constrained to `EVENT_TYPES` (Hackathon, Event, Publication, New Training, Certification). `partners` is jsonb `{name,link}`; older plain `text[]` read via `toPartnerArray()`. Covers → `event-covers`. The `publications` table is broadcast notifications only, with `type` constrained to `urgent|warning|info` (`src/pages/publications/publicationTypes.ts`; existing live tables need `supabase/publications-type-migration.sql`).
- **Attendance (denormalized log)**: `absence/AttendanceLog.tsx` stores `id, type('student'|'teacher'), full_name, class_name, date, time, created_at` + optional `program/training` snapshots; **no** `student_id/teacher_id/present`. `attendanceToWriteRows()` always resolves program/training (explicit wins; backfill by lowercase name; `class_name` falls back to training→program→specialty→`"General"`). One table, no Save button, client-side filter. Students via `loadStudentAttendance()`.
- **Exams/Grades**: exam scoped to `teacher_id`, snapshots `program/training` from chosen course; file input stores only filename. Delete cascades grades after confirm (`countGradesForExam` + `deleteExamCascade`). `saveGradesForExam` replaces all grades for exam (blank = clear). Roster via `classRosterForTeacher()`.
- **QCM**: `quizzes` (`teacher_id`, nullable `course_id`, `questions` jsonb `{id,text,options[4],correctIndex}[]` — **index**, not letter). Read via `toQuizQuestions()` (handles jsonb possibly returned as string). `quiz_responses` has unique `(quiz_id,student_id)`, stores answers as `{questionId:index}`, `score`. Published quizzes lock editing (unpublish to edit). Review panel resolves names via `classRosterForTeacher()` (unlisted → "Removed student"). Student side: `listPublishedQuizzes()`, `listStudentQuizResponses()`, `submitQuizResponse()`, `scoreQuizAnswers()` (one response per quiz).
- **Payments audit**: `updatePayment()` diffs fields and **appends** one entry to `edit_history` jsonb (`changedAt, changedBy, changes:[{field,from,to}]`); `changed_by` is cookie role (`"operator"`). Soft-delete/restore only flip flags. Receipt: `pay/PaymentReceiptModal.tsx` prints only `#receipt-print-area` via `receipt-printing` body class + print CSS (hide chrome with `.receipt-no-print`).
- **Settings**: key/value `settings` table via `getSettings`/`saveSettings` (SQL null clears). Keys: `system_name`, `university_name`, `logo_url`, `language`, `dark_mode`, `license_activated_at`, `license_token`. Fallback to `ssm-settings` localStorage if table missing; writes mirror to cache. `dark_mode` toggles `.dark` class (applied at bootstrap in `main.tsx`). Language stored-only. System tab "Sync Data" runs `reconcileAttendanceProfiles()` (backfills NULL/generic program/training by case-insensitive name match, never overwrites stored values) — mirrors SQL `public.reconcile_attendance_profiles()`.
- **License**: no backend. Expiry = `license_activated_at` + fixed `LICENSE_TERM_MONTHS` (in `src/lib/license.ts`). Accepted tokens in `LICENSE_TOKENS` array; root `token.md` is a human mirror — **keep them in sync** (app cannot read markdown at runtime). All placeholders `fake-token-…`.
- **Dashboard**: `pages/dashboard/DashboardPage.tsx` via `getDashboardStats()` — active counts, 30-day attendance-rate proxy (capped 100%), paid/pending KPIs, last-6-month series (recharts).
- **Planning**: `teacher-portal/PlanningPage.tsx` filters by `teacherId`, hand-rolled Mon–Sun week (no date lib; anchor `startOfWeek(today)`, step ±7). Excel (SheetJS)/PDF (jspdf-autotable) export only viewed week, disabled if empty.
- **Bulk import**: `.xlsx/.csv` client-side via SheetJS (`pages/students/importStudents.ts`, `pages/teachers/importTeachers.ts`, `pages/absence/importAttendance.ts`), bulk-inserts via api.ts.

## Stack Quirks

- **Tailwind v4** via `@tailwindcss/vite` — **no** `tailwind.config.js`. Theme tokens in `@theme inline` in `src/index.css`.
- **shadcn/ui (Base UI)**: `"style": "base-nova"` in `components.json`, wraps `@base-ui/react` (not Radix). Add with `npx shadcn add <component>`; icons lucide-react.
- **Path alias**: `@/*` → `src/*` must stay in sync across `vite.config.ts`, `tsconfig.app.json`, `tsconfig.json`.
- **TypeScript**: `verbatimModuleSyntax` (type-only imports need `import type`), `erasableSyntaxOnly` (no enums/namespaces/parameter properties), `noUnusedLocals`/`noUnusedParameters`. `strict` not enabled. `dist/` gitignored.

## Non-code Notes

- **Reference material**: `init/`, root `*.md` (`PRD*.md`, `TDD*.md`, `backend.md`, `project-info.md`, `vibe-code-prompts-*.md`), `claude/`, `md/` are specs/docs — not app code. `README.md` is Vite boilerplate. `accessloginpage.md` documents logins (operator only by default; teacher/student require creation).
- **Stray folder**: `superbase/` (typo) contains `passwordBD` — **never read or use**. Never commit `.env.local` or credentials.
- **OpenCode command**: `.opencode/command/verify-fix.md` exists — follow it before changing Supabase-querying code.
