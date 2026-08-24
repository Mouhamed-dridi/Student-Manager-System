# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM") backed by Supabase. No tests, no CI.

## Commands

- Dev server: `npm run dev` (or `RUN.bat`)
- Lint: `npm run lint` (oxlint — there is no ESLint)
- Typecheck/build: `npm run build` runs `tsc -b && vite build`. There is no separate typecheck script; use `npx tsc -b` to typecheck alone.
- Verify changes with `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Backend & environment

- Supabase is REQUIRED: copy `.env.example` to `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`). `src/lib/supabase.ts` throws at import time when missing, so every page fails until configured; restart Vite after editing env files.
- Schema lives in `supabase/schema.sql` (idempotent; paste into the Supabase SQL Editor). Tables: `students`, `teachers`, `payments`, `attendance`, `courses`, `exams`, `grades`, `publications`, `planning`. RLS grants full anon access — there are NO Supabase Auth accounts; auth is the fake localStorage scheme below.
- ALL Supabase I/O goes through `src/lib/api.ts`: rows are snake_case, mappers convert to/from the camelCase shapes the UI uses. Add new tables/columns/mutations there, not inline in components.
- Realtime: pages that must live-update subscribe via `subscribeToTable(table, onChange)` from api.ts and refetch on any event (StudentsPage → `students`; MyClassPage/MyCoursesPage → `students`/`courses`). It only delivers events for tables added to the `supabase_realtime` publication — new tables need an entry in the idempotent Realtime block at the bottom of `supabase/schema.sql`.
- localStorage holds ONLY session keys: `isLoggedIn`(string `"true"`)/`role` (`operator`|`student`|`teacher`, read by route guards in `src/App.tsx`) plus `currentStudentId`/`currentTeacherId`. Entity data is no longer stored locally.

## Architecture

- Four router routes (`src/App.tsx`): shared `/login`, operator `/dashboard`, student `/student`, teacher `/teacher`. Guards are role-aware: unauthenticated → `/login`; a logged-in user on another role's route bounces toward their own home where one exists (stray teachers on `/dashboard` just get `/login`); `/login` redirects authenticated users to `homeFor(role)`; the wildcard falls back by role. Sections within each side are NOT routes — they swap via `useState` inside `src/components/Layout.tsx` (operator: Students, Teachers, Pay, Absence, Publications, User Management), `src/pages/teacher-portal/TeacherLayout.tsx` (Courses, Exams & Notes, Class, Planning), and `src/pages/student-portal/StudentLayout.tsx` (Courses, My Payment, Announcements, Absence). To add a section, update that layout's `menuItems` and `pages` maps. (`MyInfoPage.tsx` exists in student-portal but is wired into no menu.)
- Pages are async over Supabase. Session helpers `loadCurrentStudent()` / `loadCurrentTeacher()` fetch the record by the localStorage id and return null — ending the session via each layout's deleted-record effect — when the record is gone or the query fails. Loading/error UI comes from `src/components/DataState.tsx` (`DataLoading`/`DataError`).
- Login is ONE page for all roles (`src/pages/LoginPage.tsx`), single name+password form, checks in order: (1) `admin`/`admin123` → operator; (2) `teachers` by **exact case-sensitive** trimmed full-name match; (3) `students` by **case-insensitive** trimmed full-name match. A matched account with `blocked === true` shows "Access has been blocked by the center." and stops; a WRONG password always gets the generic "Incorrect name or password." (blocked check runs only after a credential match). Success sets the session keys above.
- Portals share storage with no copies: student pages query the same tables the operator writes (`MyPaymentsPage` ← `payments`, including its denormalized `student_name/program/training` snapshot columns that preserve history after student edits/deletes; `AnnouncementsPage` ← `publications`), and teacher Exams/Grades/Class pages filter `students` by the teacher's own program+training. Changing an entity's shape breaks both sides.
- Account logins are just `password`/`blocked` columns on the people tables (null password = no account). `src/pages/users/userAccounts.ts` holds per-kind defaults — `DEFAULT_TEACHER_PASSWORD = "tch123"`, `DEFAULT_STUDENT_PASSWORD = "std123"` — plus `defaultAccountPassword(kind)` and `hasAccount()`; Add/Edit Student/Teacher forms, Create Account, and Reset Password all default to their kind's value. User Management manages both lists via Students|Teachers tabs over the shared `AccountsTable`.
- `src/lib/trainings.ts` owns `PROGRAMS`, `TRAININGS`, the static seeded `COURSES` schedule (keyed program → training), and `loadScheduledCourses(program, training)` — the ASYNC merged view (seeded entries carry no `id`/`teacherId`; rows from the `courses` table do) used by both portals. Most current `TRAININGS` entries have NO matching `COURSES` key, so those classes legitimately show only teacher-added courses. Add programs/trainings/seeded courses only here. Cards render through shared `CourseCardsGrid` (thumbnail `src/assets/img/courses/<slug>.jpg`, gray placeholder when missing).
- Teacher courses (`MyCoursesPage.tsx`, My Courses|Add Course tabs): auto-scoped to the teacher's program+training; stored via `saveTeacherCourse()` which returns false on failure (shown as inline form error). Day = Monday–Friday and Time = fixed slot list, both dropdowns; optional thumbnails are downscaled client-side to a ≤400px-wide JPEG data URL; `published` is an auto creation timestamp (never asked, preserved on edit) rendered as "Added <date>"; `materials` hold `{name, type}` metadata only — no file data anywhere. Edits keep original scoping; delete confirms via AlertDialog, no cascade. My Courses passes `showMaterials` + `renderActions` into `CourseCardsGrid`: Edit/Delete render only on own rows and the materials chip/dialog only where `showMaterials` is true.
- Exams & notes: `ExamsPage` writes `exams` scoped at creation; the inline Add Exam form picks the course by NAME from `loadScheduledCourses(...)` (seeded courses have no id) and its file input stores only the chosen file's name. Deleting an exam cascades its grades after a confirm dialog naming the count (`countGradesForExam` + `deleteExamCascade`). `GradesPage` saves one exam's scores wholesale via `saveGradesForExam` (deletes all of that exam's grades, reinserts non-blank inputs), so leaving an input blank clears that student's grade. Sidebar shows one "Exams & Notes" section with internal Add Exam|Grades tabs (`ExamsNotesPage.tsx`).
- Planning log (`PlanningPage.tsx`): rows in `planning` filtered strictly by `teacherId`; hand-rolled Monday–Sunday week view with NO date library (a `Date` anchored on `startOfWeek(today)`, stepped ±7 days); day cells open an add/edit/delete dialog; Excel (SheetJS `aoa_to_sheet` + `writeFile`) / PDF (`jspdf` + `jspdf-autotable`) export only the viewed week and are disabled when it has none.
- Attendance lives in one shared `attendance` table keyed `(person_type 'student'|'teacher', person_id, date, present)`; the operator Absence page shows Student|Teacher tabs (`StudentAttendance.tsx`/`TeacherAttendance.tsx`) and the student portal reads its own history via `loadPersonAttendance`.
- Bulk import parses uploaded `.xlsx`/`.csv` client-side with SheetJS (`importStudents.ts` / `importTeachers.ts`), then bulk-inserts through api.ts.
- Feature folders live in `src/pages/<feature>/` as `<Feature>Page.tsx` plus list/form subcomponents.

## Non-code folders

- `supabase/schema.sql` is the executable source of truth for the DB (see Backend section). `init/` holds product specs (`PRD.md`, `plan.md`, `bugs.md`) and `claude/` the original build prompts — reference material, not app code. `README.md` is stock Vite boilerplate. Root `accessloginpage.md` documents portal logins: only `admin`/`admin123` works out of the box — teacher/student logins exist only after records are created from the operator side (password defaults to `tch123`/`std123` respectively). `superbase/` (extra "e") is a stray non-app folder — ignore it.

## Stack quirks

- Tailwind v4 via `@tailwindcss/vite`: intentionally NO tailwind.config.js. Theme tokens and colors live in the `@theme inline` block of `src/index.css`; edit CSS there instead of creating a config file.
- shadcn/ui uses the Base UI flavor (`style: base-nova` in components.json): components in `src/components/ui/` wrap `@base-ui/react`, not Radix. Add primitives with `npx shadcn add <component>`; icons come from lucide-react.
- Path alias `@/*` → `src/*` must stay in sync in both `vite.config.ts` and `tsconfig.app.json`.
- TS settings shape code style: `verbatimModuleSyntax` (types need `import type`), `erasableSyntaxOnly` (no enums, namespaces, or parameter properties), plus `noUnusedLocals`/`noUnusedParameters`.

## Known prototype cruft

- PayPage has a "seed fake data" helper (`handleSeedFakeData`, marked TODO remove before production) that inserts 10 random payments into the real `payments` table.
