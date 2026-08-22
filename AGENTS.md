# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM"). No backend, no tests, no CI.

## Commands

- Dev server: `npm run dev` (or `RUN.bat`)
- Lint: `npm run lint` (oxlint — there is no ESLint)
- Typecheck/build: `npm run build` runs `tsc -b && vite build`. There is no separate typecheck script; use `npx tsc -b` to typecheck alone.
- Verify changes with `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Architecture

- Five router routes exist (`src/App.tsx`): operator `/login` and `/dashboard`, student-portal `/student/login`, `/student/pick`, and `/student`. Guards are role-aware via the localStorage `role` key (`operator`/`student`). Within each side, the sections — operator: students, teachers, pay, absence, publications; student: Courses, My Payment, Announcements, Absence — are NOT routes; they swap via `useState` inside `src/components/Layout.tsx` and `src/pages/student-portal/StudentLayout.tsx`. To add a section, update that layout's `menuItems` and `pages` maps. (`MyInfoPage.tsx` still exists in the student-portal folder but is not wired into any menu.)
- All persistence is browser localStorage: fake auth via `isLoggedIn`/`role` keys (read by route guards in `src/App.tsx`) plus `currentStudentId` for student sessions; entity lists keyed by simple names (e.g. `students` in `src/pages/students/StudentsPage.tsx`, attendance as date maps in `studentAttendance`). Clearing site data resets everything.
- Logins are hardcoded: operator `admin`/`admin123` (`src/pages/LoginPage.tsx`), students `std`/`std123` (`src/pages/student-portal/StudentLoginPage.tsx`, also sets an `isStudentLoggedIn` key). The student login is a shared gate: after it, `/student/pick` lists all saved students and clicking one sets `currentStudentId` for the session (auto-skipped when only one student exists).
- `src/lib/trainings.ts` is the single source of truth for `PROGRAMS`, `TRAININGS`, and the static `COURSES` schedule data (keyed by program → training); students, teachers, pay, absence, and the student Courses page all import from it. Add a program/training/course only there.
- Bulk import parses uploaded `.xlsx`/`.csv` client-side with SheetJS (`importStudents.ts` / `importTeachers.ts`).
- Feature folders live in `src/pages/<feature>/` as `<Feature>Page.tsx` plus list/form subcomponents.

## Stack quirks

- Tailwind v4 via `@tailwindcss/vite`: there is intentionally no tailwind.config.js. Theme tokens and colors are defined in `src/index.css` (`@theme inline` block); edit CSS there instead of creating a config file.
- shadcn/ui uses the Base UI flavor (`style: base-nova` in components.json): components in `src/components/ui/` wrap `@base-ui/react`, not Radix. Add new primitives with `npx shadcn add <component>`; icons come from lucide-react.
- Path alias `@/*` → `src/*` (must stay in sync in both `vite.config.ts` and `tsconfig.app.json`).
- TS settings shape code style: `verbatimModuleSyntax` (types need `import type`), `erasableSyntaxOnly` (no enums, namespaces, or parameter properties), plus `noUnusedLocals`/`noUnusedParameters`.
