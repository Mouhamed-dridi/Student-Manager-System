# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM"). No backend, no tests, no CI.

## Commands

- Dev server: `npm run dev` (or `RUN.bat`)
- Lint: `npm run lint` (oxlint — there is no ESLint)
- Typecheck/build: `npm run build` runs `tsc -b && vite build`. There is no separate typecheck script; use `npx tsc -b` to typecheck alone.
- Verify changes with `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Architecture

- Six router routes exist (`src/App.tsx`): operator `/login` and `/dashboard`, student-portal `/student/login` and `/student`, teacher-portal `/teacher/login` and `/teacher`. Guards are role-aware via the localStorage `role` key (`operator`/`student`/`teacher`). Within each side, the sections — operator: students, teachers, pay, absence, publications, user management; teacher: Courses, Exams & Notes, Class, Planning; student: Courses, My Payment, Announcements, Absence — are NOT routes; they swap via `useState` inside `src/components/Layout.tsx`, `src/pages/teacher-portal/TeacherLayout.tsx`, and `src/pages/student-portal/StudentLayout.tsx`. To add a section, update that layout's `menuItems` and `pages` maps. (`MyInfoPage.tsx` still exists in the student-portal folder but is not wired into any menu.)
- All persistence is browser localStorage: fake auth via `isLoggedIn`(string `"true"`)/`role` keys (read by route guards in `src/App.tsx`) plus `currentStudentId`/`currentTeacherId` for portal sessions; entity lists keyed by simple names (`students`, `teachers`, `payments`, `publications`, teacher-created `exams` + `grades`, attendance as date maps in `studentAttendance`). Login data (`password`/`blocked`) lives directly on the records inside the `students` and `teachers` keys. Clearing site data resets everything.
- The portals share storage with no copies: student pages read the operator-managed keys directly (`MyPaymentsPage` reads `payments`; `AnnouncementsPage` reads `publications`; login reads `students`), and teacher pages likewise (`GradesPage`/`MyClassPage` filter `students` by the teacher's program+training). Changing an operator entity's shape breaks both portals too. Resolve sessions with `loadCurrentStudent()` (`src/pages/student-portal/currentStudent.ts`) or `loadCurrentTeacher()` (`src/pages/teacher-portal/currentTeacher.ts`); both end the session if the record disappears.
- Logins: operator `admin`/`admin123` (`src/pages/LoginPage.tsx`). Students log in at `/student/login` with **full name + personal password** (case-insensitive name match) checked directly against `students` records; teachers at `/teacher/login` with **exact case-sensitive** name match against `teachers`. Check order in the login handlers matters: name not found → invalid; `blocked === true` → rejected even with correct credentials (students only — teacher login has no blocked branch yet); no password set → no-account message; then password compare. Success sets `isLoggedIn`/`role` plus `isStudentLoggedIn`+`currentStudentId` or `isTeacherLoggedIn`+`currentTeacherId`.
- Account lifecycle lives in `src/pages/users/userAccounts.ts`: kind-generic helpers (`AccountKind = "students" | "teachers"`, default `DEFAULT_ACCOUNT_PASSWORD = "std123"`). Boot seed `ensureDefaultPasswords()` in `src/main.tsx` fills a record's missing/empty password ONLY if it has no `accountInitialized` flag; every path that sets a password (seed, Create Account dialog, Reset Password, Add Student/Teacher form) stamps `accountInitialized: true`, and Delete Account strips credentials but KEEPS the flag — so deliberately deleted logins are never resurrected on reload, while pre-flag records still get seeded once. User Management page manages BOTH lists via Students|Teachers tabs over the shared `AccountsTable` component.
- `src/lib/trainings.ts` is the single source of truth for `PROGRAMS`, `TRAININGS`, and the static `COURSES` schedule data (keyed by program → training); students, teachers, pay, absence, and the student Courses page all import from it. Add a program/training/course only there. Course cards render via the shared `src/components/CourseCardsGrid.tsx` (per-training thumbnail from `src/assets/img/courses/<slug>.jpg`, gray placeholder when missing).
- Teacher exams/grades: `ExamsPage` stores into the `exams` key (`{id, teacherId, program, training, title, date, notes?}`), auto-scoped to the teacher's own program+training at creation; deleting an exam cascades its grades with a confirm dialog that names the grade count. `GradesPage` upserts `{id: "<examId>:<studentId>", examId, studentId, score}` records into `grades` in one bulk write; blank inputs clear a grade. Both read the class roster by filtering `students` on the teacher's program+training. In the sidebar they appear as one "Exams & Notes" section (`ExamsNotesPage.tsx`) with internal Exams|Notes tabs; Planning is a placeholder page with no data model yet.
- Bulk import parses uploaded `.xlsx`/`.csv` client-side with SheetJS (`importStudents.ts` / `importTeachers.ts`).
- Feature folders live in `src/pages/<feature>/` as `<Feature>Page.tsx` plus list/form subcomponents.

## Non-code folders

- `init/` holds the product specs (`PRD.md`, `plan.md`, `bugs.md`) and `claude/` holds the original build prompts — reference material, not app code. `README.md` is stock Vite template boilerplate.

## Stack quirks

- Tailwind v4 via `@tailwindcss/vite`: there is intentionally no tailwind.config.js. Theme tokens and colors are defined in `src/index.css` (`@theme inline` block); edit CSS there instead of creating a config file.
- shadcn/ui uses the Base UI flavor (`style: base-nova` in components.json): components in `src/components/ui/` wrap `@base-ui/react`, not Radix. Add new primitives with `npx shadcn add <component>`; icons come from lucide-react.
- Path alias `@/*` → `src/*` (must stay in sync in both `vite.config.ts` and `tsconfig.app.json`).
- TS settings shape code style: `verbatimModuleSyntax` (types need `import type`), `erasableSyntaxOnly` (no enums, namespaces, or parameter properties), plus `noUnusedLocals`/`noUnusedParameters`.
