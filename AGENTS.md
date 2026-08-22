# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM"). No backend, no tests, no CI.

## Commands

- Dev server: `npm run dev` (or `RUN.bat`)
- Lint: `npm run lint` (oxlint — there is no ESLint)
- Typecheck/build: `npm run build` runs `tsc -b && vite build`. There is no separate typecheck script; use `npx tsc -b` to typecheck alone.
- Verify changes with `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Architecture

- Six router routes exist (`src/App.tsx`): operator `/login` and `/dashboard`, student-portal `/student/login` and `/student`, teacher-portal `/teacher/login` and `/teacher` (the `/teacher` page is a placeholder pending the real dashboard). Guards are role-aware via the localStorage `role` key (`operator`/`student`/`teacher`). Within each side, the sections — operator: students, teachers, pay, absence, publications, user management; student: Courses, My Payment, Announcements, Absence — are NOT routes; they swap via `useState` inside `src/components/Layout.tsx` and `src/pages/student-portal/StudentLayout.tsx`. To add a section, update that layout's `menuItems` and `pages` maps. (`MyInfoPage.tsx` still exists in the student-portal folder but is not wired into any menu.)
- All persistence is browser localStorage: fake auth via `isLoggedIn`(string `"true"`)/`role` keys (read by route guards in `src/App.tsx`) plus `currentStudentId` for student sessions; entity lists keyed by simple names (`students`, `teachers`, `payments`, `publications`, attendance as date maps in `studentAttendance`). Student login data (`password`/`blocked`) lives directly on the records inside the `students` key. Clearing site data resets everything.
- The two portals share storage with no copies: student pages read the operator-managed keys directly (`MyPaymentsPage` reads `payments`; `AnnouncementsPage` reads `publications`; login/picker read `students`). Changing an operator entity's shape breaks the student portal too. Use `loadCurrentStudent()` from `src/pages/student-portal/currentStudent.ts` to resolve the session student.
- Logins: operator `admin`/`admin123` (`src/pages/LoginPage.tsx`). Students log in at `/student/login` with their **full name + personal password** checked directly against `students` records (`password`/`blocked` optional fields on the record, managed from the User Management page). Check order in the login handler matters: name not found → invalid; `blocked === true` → rejected even with correct credentials; no password set → no-account message; then password compare. Success sets `isLoggedIn`/`role`/`isStudentLoggedIn`/`currentStudentId`. Boot seed: `ensureDefaultPasswords()` in `src/main.tsx` runs every startup and fills any student record with a missing/empty password with the default `std123`, never overwriting set passwords; the Add Student form also stamps `std123` onto newly created students, so new records are usable immediately.
- `src/lib/trainings.ts` is the single source of truth for `PROGRAMS`, `TRAININGS`, and the static `COURSES` schedule data (keyed by program → training); students, teachers, pay, absence, and the student Courses page all import from it. Add a program/training/course only there.
- Bulk import parses uploaded `.xlsx`/`.csv` client-side with SheetJS (`importStudents.ts` / `importTeachers.ts`).
- Feature folders live in `src/pages/<feature>/` as `<Feature>Page.tsx` plus list/form subcomponents.

## Non-code folders

- `init/` holds the product specs (`PRD.md`, `plan.md`, `bugs.md`) and `claude/` holds the original build prompts — reference material, not app code. `README.md` is stock Vite template boilerplate.

## Stack quirks

- Tailwind v4 via `@tailwindcss/vite`: there is intentionally no tailwind.config.js. Theme tokens and colors are defined in `src/index.css` (`@theme inline` block); edit CSS there instead of creating a config file.
- shadcn/ui uses the Base UI flavor (`style: base-nova` in components.json): components in `src/components/ui/` wrap `@base-ui/react`, not Radix. Add new primitives with `npx shadcn add <component>`; icons come from lucide-react.
- Path alias `@/*` → `src/*` (must stay in sync in both `vite.config.ts` and `tsconfig.app.json`).
- TS settings shape code style: `verbatimModuleSyntax` (types need `import type`), `erasableSyntaxOnly` (no enums, namespaces, or parameter properties), plus `noUnusedLocals`/`noUnusedParameters`.
