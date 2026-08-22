# SSM student prototype — vibe-coding prompts

Feed these one at a time, in order, to your coding tool. This is the student side of the same SSM app — reuse the exact same layout, sidebar style, colors, and shadcn/ui components already built for the operator side, just with different menu items and pages.

---

**Prompt 0 — Project context**

I'm continuing work on SSM (Student Manager System), the same app as before. We already built the operator side (students, teachers, pay, absence, publications management). Now we're building the student side — a separate login and dashboard for students to view their own information. Keep the exact same visual design as the operator side: same sidebar layout, same top bar, same shadcn/ui components and styling. Still no backend, no database — everything reads from the same localStorage data the operator side already writes to.

---

**Prompt 1 — Student login page**

Build a login page for the student side, same layout and style as the operator login page (centered card, username field, password field, login button). Check credentials against a hardcoded username "std" and password "std123". On success, save a student-logged-in flag to localStorage and redirect to the student dashboard. On failure, show an inline error under the form.

---

**Prompt 2 — Select student profile (prototype only)**

Since there's only one shared student login for this prototype, right after logging in, show a simple screen listing all students currently saved in localStorage (from the operator side) as a list to pick from — click one to "become" that student for this session. Save the selected student's id to localStorage as the current student session. All following student pages show only that selected student's data. Skip this screen automatically if only one student exists in the list.

---

**Prompt 3 — Student dashboard shell with sidebar**

Build the student app layout, same visual style as the operator layout: fixed left sidebar and a main content area. The sidebar has 4 items: **Courses, My Payment, Announcements, Absence**. Clicking an item switches the content in the main area. Highlight the active item. Top bar shows the logged-in student's name (from the selected profile) and a logout button that clears both the student-logged-in flag and the selected student session, returning to student login.

---

**Prompt 4 — Courses page**

Build a courses page showing the current student's assigned courses and schedule/planning, filtered to their own Program and Training. Show it as a simple list or card layout: course name, and any schedule info available (day/time if that data exists). If no courses exist yet in the data for this student's program, show a friendly empty state message instead of an empty page.

---

**Prompt 5 — My Payment page**

Build a page showing the current student's own payment history, pulled from the payments data already saved by the operator side, filtered to only this student. Show a table: date, amount, plan type, status. If no payments exist for this student, show an empty state message. No add/edit actions here — this page is read-only for the student.

---

**Prompt 6 — Announcements page**

Build a page showing publications/announcements sent to students, pulled from the operator side's publications data, filtered to only the ones where "students" was selected as a recipient. Show them as a simple list, most recent first: title, message, and date. Read-only, no actions.

---

**Prompt 7 — Absence page**

Build a page showing the current student's own attendance history, pulled from the student attendance data already saved by the operator side, filtered to only this student. Show a simple table or list: date, present or absent. Read-only, no actions. If no attendance records exist yet, show an empty state message.
