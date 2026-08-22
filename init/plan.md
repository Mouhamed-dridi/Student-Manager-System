# implementation_plan.md

# Purpose: Breaks down the roadmap into small, phase-by-step technical execution blocks. Why you need it: Forces the AI to plan before it codes, letting you approve steps safely.

# each time you generate implementation plan this plan.md must update automatic

## Status legend

- [x] shipped — [ ] planned

## Completed phases

1. **[x] Scaffold** — Vite 8 + React 19 + TypeScript, Tailwind v4 (CSS-first via `src/index.css`), shadcn/ui Base UI flavor (`base-nova`), oxlint, `@/*` path alias.
2. **[x] Routing + auth guards** — five routes in `src/App.tsx` (`/login`, `/dashboard`, `/student/login`, `/student/pick`, `/student`) with role-aware redirects driven by localStorage `isLoggedIn`/`role`.
3. **[x] Operator shell** — `Layout.tsx` sidebar; sections (students/teachers/pay/absence/publications) swap via `useState` over `menuItems`/`pages` maps, not routes.
4. **[x] Students CRUD** — list/add/edit/delete in `src/pages/students/`; entity persisted under `students`.
5. **[x] Bulk import (students)** — SheetJS parse of `.xlsx`/`.csv` (`importStudents.ts`) with preview tab and skipped-row summary.
6. **[x] Teachers CRUD + bulk import** — mirrors students (`src/pages/teachers/`).
7. **[x] Payments** — autocomplete student picker, plan types, payment list; printable ticket/receipt popup windows (`PrintTicket.tsx`, `PrintReceipt.tsx`); stored under `payments`.
8. **[x] Attendance** — date-based grids for students and teachers (`src/pages/absence/`), stored as date maps in `studentAttendance` / teacher attendance keys.
9. **[x] Publications** — announcement composer + history table, stored under `publications`.
10. **[x] Student portal** — shared login gate, student picker (`currentStudentId` session), `StudentLayout.tsx` with Courses / My Payment / Announcements / Absence reading operator-managed keys directly.
11. **[x] Docs** — root `AGENTS.md` and this `init/` folder filled in.
12. **[x] User Management + per-student login** — new operator section (`src/pages/users/`): account table (masked password w/ show-hide, Active/Blocked badge), Block/Unblock, Reset Password dialog (defaults `std123`), Delete Account with confirmation (strips only `password`/`blocked`, record survives), Create Account dialog for password-less students, name search. Student login is now one form (full name + personal password) checked against records; blocked students rejected even with correct credentials. `/student/pick` and the shared `std`/`std123` gate removed; boot seed tops up missing passwords with `std123` on every start and the Add Student form stamps the default on new records, so no normal flow leaves a student password-less. Editing a student in Students page no longer wipes their login data.
12b. **[x] Seed rework** — replaced the one-time `studentAccountsSeeded` flag migration with an every-boot fill of missing/empty passwords (`ensureDefaultPasswords()`), plus form-level default for new students.

## Backlog (proposed next phases)

13. **[ ] Wire MyInfoPage** — `MyInfoPage.tsx` exists but is not in any student menu; add it to `StudentLayout.tsx`'s `menuItems`/`pages`.
14. **[ ] Data export/backup** — download/import JSON snapshots of all localStorage keys.
15. **[ ] Dashboard stats** — counts/totals (students per program, payments total) on a real dashboard view instead of the bare shell.
16. **[ ] Cleanup orphans** — deleting a student leaves their payments/attendance rows behind; cascade or surface them.
17. **[ ] Teacher portal** — login page + routing scaffolding shipped (`/teacher/login`, `/teacher` placeholder, `teacher` role, session keys incl. `currentTeacherId`); pending: teacher account seeding/form defaults (Prompt 4.3), User Management Teachers tab, real dashboard layout with Courses / Exams / Grades / My Class sections.

> Any future backend/sync work is explicitly out of scope for now (see PRD.md).
