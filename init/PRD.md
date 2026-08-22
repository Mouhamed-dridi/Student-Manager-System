# PRD.md

# Purpose: Defines what you are building, the target audience, core features, and what is out of scope

## Product overview

SSM (Student Manager System) is an internal admin tool for a small vocational training center running three programs — **BTP**, **BTS**, **CAP** — each split into named trainings (e.g. "Comptable d'entreprise", "Agent d'entrepôt"). School operators manage students, teachers, payments, attendance, and announcements; students get a personal read-only portal.

It is a **frontend-only React 19 SPA prototype**. There is no backend or database: everything persists in browser **localStorage**, so data lives per browser/device and clearing site data resets the whole system.

## Target audience

- **Operator** (school staff): full management access via `/login` — hardcoded `admin` / `admin123`.
- **Student**: read-only self-service via `/student/login` — one shared credential `std` / `std123`; after login the student picks their own name (skipped automatically when only one student exists).

## Core features

### Operator portal (`/dashboard`, sections swap inside `Layout.tsx`)

1. **Students** — list + add/edit form (fullName, program BTP/BTS/CAP, training dependent on program, phone, email) + delete. Bulk import `.xlsx`/`.csv` with a preview step and skipped-row summary.
2. **Teachers** — same list / add / import pattern.
3. **Pay** — record a payment for a student picked via search-by-name autocomplete: amount, plan type (one-time / semester / monthly), date. Generates printable **ticket** and **receipt** popups.
4. **Absence** — daily attendance grids (separate tabs for students and teachers): pick a date, mark Present/Absent per person.
5. **Publications** — compose announcements (title, message, recipients: teachers/students, channels: SMS/Email/Notification) with a history table and delete-with-confirm. Messages are recorded, **never actually delivered**.

### Student portal (`/student`, sections swap inside `StudentLayout.tsx`)

- **Courses** — weekly schedule shown for the logged-in student's program + training (static data).
- **My Payment** — the payment history filtered to the session student.
- **Announcements** — the operator's publication history.
- **Absence** — the student's own attendance history.

Both portals read/write the **same localStorage keys**, so operator edits appear instantly in the student portal.

## Out of scope

- Any server, API, database, real auth service, or account management.
- Real message delivery (SMS/email/notification are labels only).
- Data sync across devices/browsers; backups or export of localStorage data.
- More roles than operator/student; per-student passwords.
