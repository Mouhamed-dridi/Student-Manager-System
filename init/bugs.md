# bugs.md

# Purpose: Tracks active tasks or specific error logs and current focus areas. Why you need it: Keeps the AI's context window healthy and focused on micro-tasks rather than overwhelming the whole app.

## Active bugs

None open as of 2026-08-22 (full codebase review found no crashes or broken flows).

## Known limitations (accepted for the prototype)

- **Plaintext passwords** — student passwords are stored and compared as plain text in localStorage. Fine locally; must be revisited before any real deployment (hashing + a backend).
- **Duplicate full names match first occurrence** — login looks students up by case-insensitive exact `fullName`; two students with the same name resolve to the first saved record. A real system needs a unique identifier.
- **Delete Account is temporary under the boot seed** — `ensureDefaultPasswords()` runs every startup and re-fills any password-less record with `std123`, so an account deleted via User Management comes back on next reload (blocked status does not). "Create Account" likewise finds nothing after a restart. If true removal is ever needed, the seed needs an opt-out marker.
- **Orphaned records on delete** — deleting a student keeps their rows in `payments` and `studentAttendance`; they are invisible but still in storage. Deleting a logged-in student's record is handled: the session ends (`StudentLayout.tsx` effect).
- **Publications are not delivered** — SMS/email/notification channels and recipients are recorded labels only; no message ever leaves the browser.
- **Silent storage corruption fallback** — every `JSON.parse(localStorage...)` failure returns an empty list/map with no user-facing warning; corrupted data looks like "no data yet".
- **Unbounded lists** — students/teachers/payments/accounts tables render all rows; no pagination or virtualization.
- **MyInfoPage unwired** — component exists but appears nowhere (backlog item #13).

## Focus areas

- Keep operator ↔ student localStorage shapes in sync when touching entity fields (highest regression risk in this codebase).
- After any change to `src/lib/trainings.ts`, re-check Students/Teachers/Pay/Absence forms and the student Courses page — all import from it.
