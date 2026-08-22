# inti.md — developer instructions

# Purpose: Acts as developer instructions, tech stack configurations, run/test commands, and strict style rules. Why you need it: Automatically loads context every time the AI agent opens your project workspace.

# ecah time load or run \init update this file with what we have as update in this app

## Tech stack

- React 19 + TypeScript + Vite 8 SPA ("SSM"). No backend — all data in browser localStorage.
- Tailwind v4 via `@tailwindcss/vite` — **no tailwind.config.js**; theme tokens/colors live in the `@theme inline` block of `src/index.css`. Edit CSS there.
- shadcn/ui Base UI flavor (`style: base-nova` in `components.json`) — components in `src/components/ui/` wrap `@base-ui/react`, **not Radix**. Add primitives with `npx shadcn add <component>`.
- Icons: lucide-react. Routing: react-router-dom v7.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (or `RUN.bat`) |
| Lint | `npm run lint` (oxlint — no ESLint) |
| Typecheck only | `npx tsc -b` |
| Build | `npm run build` (= `tsc -b && vite build`) |

Verification order for every change: `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Strict style rules

- `verbatimModuleSyntax`: types need `import type`.
- `erasableSyntaxOnly`: no enums, namespaces, or parameter properties.
- `noUnusedLocals` / `noUnusedParameters`: zero dead code.
- Path alias `@/*` → `src/*` (kept in sync in both `vite.config.ts` and `tsconfig.app.json`).
- Feature folders: `src/pages/<feature>/` with `<Feature>Page.tsx` + list/form/import subcomponents.
- Sections are NOT routes: they swap via `useState` over `menuItems` + `pages` maps in `src/components/Layout.tsx` (operator) and `src/pages/student-portal/StudentLayout.tsx` (student). New section = edit those maps.
- Entity IDs: `crypto.randomUUID()`.
- Keep operator and student portals in sync: student pages read operator localStorage keys directly; changing an entity's shape breaks both.

## Data model (localStorage keys)

| Key | Shape | Written by | Read by |
|---|---|---|---|
| `isLoggedIn` | `"true"` | logins | route guards (`App.tsx`) |
| `role` | `"operator"` \| `"student"` | logins | route guards |
| `isStudentLoggedIn` | `"true"` | student login | logout cleanup |
| `currentStudentId` | student id | student login | session resolution |
| `students` | `Student[]` (id, fullName, program BTP/BTS/CAP, training, phone, email + optional login fields `password`, `blocked`, `accountInitialized`) | StudentsPage, UserManagementPage, boot seed | teachers/pay/absence pages, student portal |
| `teachers` | `Teacher[]` (+ optional login fields `password`, `blocked`, `accountInitialized`) | TeachersPage, UserManagementPage, boot seed | absence page, teacher portal |
| `exams` | `{id, teacherId, program, training, title, date, notes?}[]` (teacher-created, scoped to their class) | ExamsPage | GradesPage |
| `grades` | `{id: "<examId>:<studentId>", examId, studentId, score}[]` | GradesPage | deleted with their exam |
| `payments` | `Payment[]` (amount, planType one-time/semester/monthly, date) | PayPage | MyPaymentsPage |
| `publications` | `Publication[]` (title, message, recipients, channels) | PublicationsPage | AnnouncementsPage |
| `studentAttendance` | `{ [date]: { [studentId]: boolean } }` | AbsencePage | MyAttendancePage |

Login accounts live ON the student records: User Management (`src/pages/users/`) sets/resets/strips `password` and toggles `blocked`; the student portal checks name+password against the same records. Every boot (`main.tsx`) tops up missing/empty passwords with default `std123` — set passwords are never overwritten; the Add Student form stamps the same default onto new records.

Programs/trainings/courses come from `src/lib/trainings.ts` (`PROGRAMS`, `TRAININGS`, static `COURSES`) — the single source of truth; never hardcode them elsewhere.

## Current app state (keep updated)

Implemented end-to-end: operator login (`admin`/`admin123`), dashboard shell, Students CRUD + Excel import, Teachers CRUD + import, Payments with printable ticket/receipt, student & teacher attendance grids, publications, User Management (Students|Teachers tabs: create/block/reset/delete accounts), student portal (per-student full-name + password login with blocked-account enforcement; Courses / My Payment / Announcements / Absence), teacher portal (exact name + password login; Courses / Exams & Notes (tabs) / Class / Planning placeholder scoped to the teacher's own class). Course cards show per-training thumbnails from `src/assets/img/courses/` (slugified names, gray placeholder when missing).

Known gap: `MyInfoPage.tsx` exists but is unwired (see `plan.md` backlog).
