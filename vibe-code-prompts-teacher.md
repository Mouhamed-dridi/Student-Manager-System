# SSM teacher prototype — vibe-coding prompts

Feed these one at a time, in order, to your coding tool. This is the teacher side of the same SSM app — reuse the exact same layout, sidebar style, colors, and shadcn/ui components already built for the operator and student sides, just with different menu items and pages. Requires Prompt 4.3 (teacher password field) already built on the operator side first.

---

**Prompt 0 — Project context**

I'm continuing work on SSM (Student Manager System), the same app as before. We already built the operator side (students, teachers, pay, absence, publications, user management) and the student side (courses, payment, announcements, absence). Now we're building the teacher side — a separate login and dashboard for teachers to manage their own courses, exams, grades, and class. Keep the exact same visual design as the other two sides: same sidebar layout, same top bar, same shadcn/ui components and styling. Still no backend, no database — everything reads from and writes to the same localStorage data the other sides already use.

---

**Prompt 1 — Teacher login page**

Build a login page for the teacher side, same layout and style as the other login pages (centered card, "Full Name" field, password field, login button). On submit, check the entered name and password against the teachers list saved in localStorage, matching exactly against each teacher's Full Name and Password. If they match, save that teacher's id to localStorage as the current teacher session and redirect to the teacher dashboard. If no match, show an inline error saying the name or password is incorrect.

---

**Prompt 2 — Teacher dashboard shell with sidebar**

Build the teacher app layout, same visual style as the other sides: fixed left sidebar and a main content area. The sidebar has 4 items: **Courses, Exams & Notes, Class, Planning**. Clicking an item switches the content in the main area. Highlight the active item. Top bar shows the logged-in teacher's name and their Program/Training (same style as the student side's top bar, e.g. "Sami Bouzid · BTP — Gestion informatique"), plus a logout button that clears the current teacher session, returning to teacher login.

---

**Prompt 3 — Courses page (teacher's own)**

Build a courses page with two views: "My Courses" and "Add Course". My Courses lists all courses in the shared courses data whose Program and Training match this teacher's own Program and Training, showing title and schedule (day/time). Add Course is a form: title, day, time — Program and Training are not asked, they're automatically set to the teacher's own values. On submit, save the new course to the same shared courses list used by the student side (so it appears immediately in matching students' Courses page too), tagged with this teacher's id. On My Courses, courses this teacher personally added show an edit/delete action; courses that came from elsewhere (like seeded demo data) are shown but without edit/delete.

---

**Prompt 4 — Exams & Notes page**

Build a page with two sections, switched by tabs: "Add Exam" and "Grades". Add Exam is a form: exam title, a dropdown to pick which of this teacher's own courses it belongs to, date, and a file upload field (store just the filename in localStorage for this prototype, no real file storage). Saved to an exams list in localStorage. Grades tab: a dropdown to pick one of this teacher's exams, then a list of every student whose Program and Training match this teacher's own, each with a numeric grade input next to their name. A save button stores all entered grades for that exam in one action, keyed by exam and student. If some grades were already entered for that exam, load and show the existing values instead of blank inputs.

---

**Prompt 5 — Class page**

Build a page showing a read-only table of every student whose Program and Training match this teacher's own Program and Training — this is "the teacher's class". Columns: Full Name, Phone, Email. Add a search bar to filter by name. No edit/delete actions here, this is informational only for the teacher.

---

**Prompt 6 — Planning page**

Build a page for the teacher to log what was studied each day. A form: date, and a text field for what topic/content was covered, plus a dropdown to pick which of this teacher's own courses it relates to. On submit, save it to a planning list in localStorage tied to this teacher. Below the form, show a list of previously logged entries for this teacher, most recent first, with an edit and delete action on each.
