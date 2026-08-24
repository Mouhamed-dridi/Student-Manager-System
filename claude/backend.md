
Feed these one at a time. This replaces localStorage with Supabase (a hosted Postgres database with an auto-generated REST API), so operator, teacher, and student data syncs across any browser or device immediately, instead of being stuck in one browser. Do the Supabase setup steps yourself first (see note before Prompt 1), then feed the prompts to your coding tool.

Go to supabase.com, create a free account and a new project. Once it's created, open the project's Table Editor and create these tables, matching the fields already used across the app: `students` (full_name, program, training, phone, email, password, blocked), `teachers` (full_name, program, training, phone, email, password, blocked), `payments` (student_id, amount, plan_type, date, status), `attendance` (person_id, person_type, date, present), `courses` (title, program, training, day, time, teacher_id, thumbnail_url, published_at), `exams` (teacher_id, course_id, title, date, file_name), `grades` (exam_id, student_id, score), `publications` (title, message, recipients, channels, sent_at), `planning` (teacher_id, course_id, date, topic). From your project's Settings → API page, copy the Project URL and the anon public API key — you'll give these to your coding tool in Prompt 1.

I'm continuing work on SSM (Student Manager System). The frontend (React + shadcn/ui, three sides: operator, teacher, student) is already built and currently stores everything in the browser's localStorage. I've created a Supabase project with tables matching the app's existing data. I want to replace localStorage with Supabase so data is shared and synced across different browsers and devices in real time, not stuck per-browser. Install the Supabase JS client library and connect it using the Project URL and anon key I'll provide.

---

**Prompt 1 — Connect Supabase and set up the client**

Install `@supabase/supabase-js`. Create a single shared Supabase client file the rest of the app will import from, configured with my Project URL and anon key (I'll paste these in as environment variables, not hardcoded in the code). Confirm the connection works by fetching an empty list from one of the tables.

Go through the frontend and replace every place it currently reads from or writes to localStorage for students, teachers, payments, attendance, courses, exams, grades, publications, and planning, with the matching Supabase call instead (`select`, `insert`, `update`, `delete` on the matching table). Keep all existing UI, forms, tables, filters, and logic exactly as they are — only the data-loading and data-saving functions change. Add a simple loading state while a page's data is being fetched, and a simple error message if a request fails, matching the app's existing style.

---

**Prompt 3 — Login against Supabase**

Update the single login page to check the entered name and password against Supabase instead of localStorage: hardcoded admin check first, then query the `teachers` table for a matching full_name + password (checking blocked), then the `students` table the same way, same priority order and messages as already built. On success, store the matched user's id and role in the browser (localStorage is fine just for "who's currently logged in on this device" — the actual student/teacher/payment data all lives in Supabase now).

---

**Prompt 4 — Real-time sync (optional but recommended)**

On pages where it matters most — the operator's Student List, Teacher's Class, and Teacher's My Courses — subscribe to Supabase's real-time updates for that table, so if data changes in another browser (e.g. the operator adds a student), this page updates automatically without needing a manual refresh.
