# SSM backend migration — vibe-coding prompts (Supabase)

Feed these one at a time. This replaces localStorage with Supabase (a hosted Postgres database with an auto-generated REST API), so operator, teacher, and student data syncs across any browser or device immediately, instead of being stuck in one browser. Do the Supabase setup steps yourself first (see note before Prompt 1), then feed the prompts to your coding tool.

---

**Before Prompt 1 — one-time manual setup**

Go to supabase.com, create a free account and a new project. Once it's created, open the project's Table Editor and create these tables, matching the fields already used across the app: `students` (full_name, program, training, phone, email, password, blocked), `teachers` (full_name, program, training, phone, email, password, blocked), `payments` (student_id, amount, plan_type, date, status), `attendance` (person_id, person_type, date, present), `courses` (title, program, training, day, time, teacher_id, thumbnail_url, published_at), `exams` (teacher_id, course_id, title, date, file_name), `grades` (exam_id, student_id, score), `publications` (title, message, recipients, channels, sent_at), `planning` (teacher_id, course_id, date, topic). From your project's Settings → API page, copy the Project URL and the anon public API key — you'll give these to your coding tool in Prompt 1.

---

**Prompt 0 — Project context**

I'm continuing work on SSM (Student Manager System). The frontend (React + shadcn/ui, three sides: operator, teacher, student) is already built and currently stores everything in the browser's localStorage. I've created a Supabase project with tables matching the app's existing data. I want to replace localStorage with Supabase so data is shared and synced across different browsers and devices in real time, not stuck per-browser. Install the Supabase JS client library and connect it using the Project URL and anon key I'll provide.

---

**Prompt 1 — Connect Supabase and set up the client**

Install `@supabase/supabase-js`. Create a single shared Supabase client file the rest of the app will import from, configured with my Project URL and anon key (I'll paste these in as environment variables, not hardcoded in the code). Confirm the connection works by fetching an empty list from one of the tables.

---

**Prompt 2 — Replace localStorage reads/writes with Supabase calls**

Go through the frontend and replace every place it currently reads from or writes to localStorage for students, teachers, payments, attendance, courses, exams, grades, publications, and planning, with the matching Supabase call instead (`select`, `insert`, `update`, `delete` on the matching table). Keep all existing UI, forms, tables, filters, and logic exactly as they are — only the data-loading and data-saving functions change. Add a simple loading state while a page's data is being fetched, and a simple error message if a request fails, matching the app's existing style.

---

**Prompt 3 — Login against Supabase**

Update the single login page to check the entered name and password against Supabase instead of localStorage: hardcoded admin check first, then query the `teachers` table for a matching full_name + password (checking blocked), then the `students` table the same way, same priority order and messages as already built. Default passwords differ by role: students default to "std123", teachers default to "tch123" — this only affects what's pre-filled when an operator creates a new account, the login check itself always compares against whatever password is actually saved on that person's record. On success, store the matched user's id and role in the browser (localStorage is fine just for "who's currently logged in on this device" — the actual student/teacher/payment data all lives in Supabase now).

---

**Prompt 4 — Fix Program/Training display and filtering everywhere in the app**

After migrating to Supabase, every student and teacher record now has `program_id` and `training_id` (foreign keys pointing to the `programs` and `trainings` tables) instead of the old plain-text `program`/`training` fields the app was originally built against. Right now, anywhere the app displays or filters by Program or Training, it's still reading the old field names, which no longer exist — so those columns show blank, subtitles like "Teaching — ()" show empty, and any filtering logic that compares them is silently broken (matching everyone instead of the right subset, since it's comparing two blank values).

Go through the entire codebase — both the operator side and the teacher side — and fix every one of these:

1. **Every Supabase query that fetches students or teachers** must also fetch the related program and training names through the relationship, not just the raw foreign key. Use Supabase's nested select syntax, e.g. `.select('*, programs(code, name), trainings(name)')`, so each row comes back with the actual program code and training name attached, not just a UUID.
2. **Operator's Student List table** — the Program and Training columns are currently blank. Fix them to display the joined `programs.code` and `trainings.name` values.
3. **Operator's Teacher List table** — same fix, same columns.
4. **Operator's Add Student / Add Teacher forms and their filter panels** — anywhere Program/Training is shown or used to filter, confirm it's reading the joined values, not the old text fields.
5. **Pay page** — the student autocomplete's auto-filled Program/Training display (read-only confirmation fields) needs the same fix.
6. **Absence page filters** — same Program/Training filter panel fix as the Student/Teacher lists.
7. **Teacher side top bar** ("Full Name · Program — Training") and the **Courses page subtitle** ("Teaching X (Y)") — same fix.
8. **Teacher's My Class page** — this is the most important one to get right: fix the actual filtering query to match students by comparing `program_id` and `training_id` (the real foreign keys) against the logged-in teacher's own `program_id`/`training_id` — not by comparing old text fields that no longer exist, which is currently why every student shows up in every teacher's class instead of just their own 5.
9. **Teacher's My Courses page filtering** — same fix as My Class, applied to courses.

After this fix, re-check: the Student List and Teacher List should show real Program/Training values instead of blank columns, and each teacher's My Class should show exactly their own students (5 per teacher, based on the current seeded data), not the full roster.

---

**Prompt 5 — Fix User Management showing no accounts**

The User Management page's Students and Teachers tabs should each show every student/teacher that currently has a password set — which, after the latest database rebuild, means every single one of them (all 60 students, all 12 teachers), since they all have a default password already. Right now the list appears empty or shows "No accounts match" even without typing anything in the search box, which means the underlying query is either filtering incorrectly or not fetching from Supabase correctly. Fix the query behind both tabs to: fetch all students (or all teachers, on that tab) from Supabase with their `full_name`, `password`, and `blocked` status; treat "has an account" as simply having a non-null password (true for all current records); and make sure clearing the search box shows the complete list, not an empty one. Confirm the "Create Account" dialog's opposite logic (listing students/teachers with NO password) correctly shows zero people right now, since none currently lack one.

---

**Prompt 5.1 — Show Program on User Management**

On the User Management page, add a "Program" column to both the Students and Teachers tables, placed between Full Name and Password. Show each person's program level (BTP, BTS, or CAP) by fetching it through the same relationship join used elsewhere in the app (`program_id` → `programs.code`) — do not add a plain text field, read it from the actual relationship so it can never drift out of sync with the Students/Teachers pages. If you want Training shown too, not just the Program level, say so and I'll extend this — right now it's scoped to Program only, matching what you asked for.

---

**Prompt 5.2 — Clickable profile page for each student/teacher**

On the User Management page, make each row's Full Name clickable, opening a dedicated profile page for that person instead of just editing inline. The profile page has two sections, styled consistently with the rest of the app (not literal copies of any external template — same fonts, spacing, and card style already used elsewhere):

**Personal details card** — Full Name, Program, Training (both joined through the relationship, not raw IDs), Phone, Email. Read-only display here; editing still happens through the existing Edit action on the Student/Teacher list, not duplicated on this page.

**Security section** — current Status (Active/Blocked badge), a masked Password field with the same show/hide toggle already used in the User Management table, and the same three actions already built there: Block/Unblock, Reset Password, Delete Account — moved here as the primary place to manage them, rather than only inline table buttons.

For a student's profile specifically, add a third section: **Payment history**, showing that student's own payments (date, amount, plan type, status), read-only, pulled the same way the student's own My Payment page already does. For a teacher's profile, add a third section: **Class**, showing a read-only count and list of students in that teacher's domain, same data as their My Class page.

Add a "Back" link/button at the top of the profile page returning to the User Management list.

---

**Prompt 6 — Full audit: remove leftover localStorage, verify Supabase end to end**

Go through the entire project (every file under src/, or wherever the app's source lives) and search for any remaining use of `localStorage` — the app was migrated to Supabase, but some pages (Student List, User Management, and possibly others) are showing wrong or empty data, which suggests some code paths may still be reading from or writing to localStorage instead of Supabase, left over from before the migration. For each place you find:

1. Report the file and what it's doing with localStorage.
2. Confirm whether it's genuinely leftover dead code (safe to delete) or something intentionally still local (e.g. "which student/teacher/admin is currently logged in on this device" — that one is fine to keep local, everything else should not be).
3. Delete the leftover localStorage reads/writes and replace them with the equivalent Supabase call, matching the pattern already used elsewhere in the app.

After that cleanup, verify the Supabase connection itself is fully working:
1. Confirm the Supabase client is initialized correctly from the environment variables.
2. Confirm every table the app depends on (programs, trainings, students, teachers, admins, payments, attendance, courses) can actually be queried without error.
3. Confirm Row Level Security policies allow the app's anon key to read and write — not just get an empty result silently, actually check that data comes back.
4. Confirm login (admin, teacher, student) genuinely round-trips through Supabase, not any local fallback.
5. Report a clear pass/fail list at the end: which parts of the backend connection are confirmed working, and which still have a problem.

Do not fix the Program/Training display bug or the User Management bug as part of this prompt — those are separate, already covered. This prompt is specifically about finding stale localStorage code and confirming the Supabase connection itself is sound.

---

**Prompt 7 — Auto-update data in the background, no button**

Instead of requiring a manual refresh, make key pages update themselves automatically whenever the underlying Supabase data changes — using Supabase's real-time subscriptions, not a button. Apply this to: User Management (Students and Teachers tabs), the operator's Student List and Teacher List, the Teacher's My Class page, and the Teacher's My Courses page. For each of these, after the initial data fetch on page load, subscribe to real-time changes on the relevant table(s) (students, teachers, courses) — when a row is inserted, updated, or deleted anywhere (another browser, another tab, another user), the page's data should update itself within a second or two, with no click, no button, and no full page reload. Make sure each page properly unsubscribes when it's left/unmounted, so subscriptions don't pile up as the operator or teacher navigates between pages. As a quiet fallback only — not the primary mechanism — also re-fetch the page's data once automatically if the browser tab regains focus after being in the background for a while, in case the real-time connection silently dropped during that time.
