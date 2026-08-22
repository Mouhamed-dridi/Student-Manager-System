# bugs.md

# Purpose: Tracks active tasks or specific error logs and current focus areas. Why you need it: Keeps the AI's context window healthy and focused on micro-tasks rather than overwhelming the whole app.

## Active bugs

None open as of 2026-08-22 (full codebase review found no crashes or broken flows).

## Known limitations (accepted for the prototype)

- **Plaintext passwords** — student/teacher passwords are stored and compared as plain text in localStorage. Fine locally; must be revisited before any real deployment (hashing + a backend).
- **Duplicate full names match first occurrence** — logins look users up by exact `fullName` (case-insensitive for students, case-sensitive for teachers); two records with the same name resolve to the first saved one. A real system needs a unique identifier.
- **Shared session keys across portals** — `isLoggedIn` and `role` are single global keys, so logging into the operator dashboard while a student portal tab is open silently overrides that student's session in the same browser (and vice versa). The per-portal keys (`isStudentLoggedIn`+`currentStudentId`, `isTeacherLoggedIn`+`currentTeacherId`) stay intact, so re-navigating restores the right session after re-login. Accepted for the prototype; real fix is per-role session keys.
- **Orphaned records on delete** — deleting a student keeps their rows in `payments` and `studentAttendance`; they are invisible but still in storage. Deleting a logged-in student's or teacher's record is handled: the portal session ends (`StudentLayout.tsx` / `TeacherLayout.tsx` effects). Deleting an exam cascades its grades by design (confirm dialog names the count); deleting a student does NOT remove their grade rows, which become invisible orphans.
- **Teacher login has no blocked branch** — students can be blocked from login via User Management, but the teacher login handler never checks `blocked`; blocking a teacher record has no effect until parity is added.
- **Publications are not delivered** — SMS/email/notification channels and recipients are recorded labels only; no message ever leaves the browser.
- **Silent storage corruption fallback** — every `JSON.parse(localStorage...)` failure returns an empty list/map with no user-facing warning; corrupted data looks like "no data yet".
- **Unbounded lists** — students/teachers/payments/accounts/exams tables render all rows; no pagination or virtualization.
- **MyInfoPage unwired** — component exists but appears nowhere (backlog item #13).

## Focus areas

- Keep operator ↔ student localStorage shapes in sync when touching entity fields (highest regression risk in this codebase).
- After any change to `src/lib/trainings.ts`, re-check Students/Teachers/Pay/Absence forms and the student Courses page — all import from it.
