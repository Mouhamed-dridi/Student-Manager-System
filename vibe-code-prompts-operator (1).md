# SSM operator prototype — vibe-coding prompts

Feed these one at a time, in order, to your coding tool. Start with Prompt 0 to set the project context, then go through the pages in order.

---

**Prompt 0 — Project context**

I'm building SSM (Student Manager System), a management app for training centers. It has three types of users: operators (center staff who handle registration, payments, and attendance), teachers (who upload courses and grade exams), and students (who view their courses and grades). For this first prototype, we are only building the operator side. Tech stack: React with shadcn/ui for components, no backend and no database for now — all data is stored in the browser's localStorage. I will describe each page one at a time, build them in the order I give them, and keep the UI clean and minimal using shadcn/ui components throughout.

---

**Prompt 1 — Login page**

Build a login page in React using shadcn/ui. A centered card with a title, a username field, a password field, and a login button. Check the credentials against a hardcoded username "admin" and password "admin123". On success, save a logged-in flag to localStorage and redirect to the dashboard. On failure, show an inline error under the form. Clean, minimal, centered on the page.

---

**Prompt 2 — Dashboard shell with sidebar**

Build an app layout with a fixed left sidebar and a main content area. The sidebar has 5 menu items: Students, Teachers, Pay, Absence, Publications. Clicking a menu item switches the content shown in the main area. Highlight the active menu item. Include a simple top bar with the app name and a logout button that clears the logged-in flag and returns to the login page. Keep the sidebar and layout minimal and clean, shadcn/ui components.

---

**Prompt 3 — Students page**

Build a students management page with two views switched by tabs: "Add student" and "Student list". The add form has fields: full name, program (dropdown with options BTP, BTS, CAP), phone number, email. On submit, save the student to localStorage under a students list and switch to the list view. The student list is a table showing all saved students with edit and delete actions per row. Edit opens the same form pre-filled. Deleting asks for confirmation first.

---

**Prompt 3.1 — Bulk import students from Excel**

On the Students page, next to the "Student List" and "Add Student" tabs, add an "Import Excel" button, same row, side by side with the other two — not a separate page. Clicking it opens a file picker for Excel files (.xlsx or .csv). The file's columns match the student fields: full name, program, training, phone number, email. After picking a file, parse every row and show a preview table of what will be imported before anything is saved. Add a "Confirm Import" button below the preview that adds every row from the file into the students list in localStorage in one action, and a "Cancel" button that discards the preview without saving anything. If a row is missing required data, skip that row and show how many rows were skipped in the confirmation message.

---

**Prompt 3.2 — Training type field, dependent on Program**

On the Add Student form, add a "Training" field right after the Program field, as a dropdown. Its options depend on which Program is selected: if Program is CAP, the Training options are "Gestion caissier" and "Photographe". If Program is BTP, the options are "Gestion informatique", "Développement web", and "Design infographique". If Program is BTS, the options are "Réseaux sécurité informatique", "Développement web mobile", and "Gestion et finance". The Training dropdown is disabled and empty until a Program is picked, and it resets whenever the Program changes. Save the selected training value with the student record. Add a "Training" column to the Student List table, placed right after the Program column, showing each student's saved training.

---

**Prompt 3.3 — Fix: Import preview missing the Training column**

The Import Excel preview table on the Students page currently only shows Full Name, Program, Phone, and Email — it's missing the Training column. Update the import preview table to also read and display a "Training" column from the uploaded file, placed right after Program, matching the same column order used in the Student List table. Make sure the Training value from each imported row is actually saved to localStorage along with the rest of the student record when Confirm Import is clicked, not just shown in the preview.

---

**Prompt 3.4 — Search and filter on Student List**

On the Student List view, above the table, add a search bar and a "Filter" button on the same row. The search bar searches by full name as the user types, matching against all currently loaded students. The Filter button opens a small dropdown panel with two filter fields: a "Program" dropdown (All, BTP, BTS, CAP) and a "Training" dropdown, whose options depend on the selected Program using the same mapping as the Add Student form — if Program is "All", show every training option from every program. Both the search text and the filter selections apply together, narrowing the same table. Show a small "Clear filters" link when any filter or search is active, which resets everything back to the full list.

---

**Prompt 4 — Teachers page**

Build a teachers management page, same pattern as students: two tabs, "Add teacher" and "Teacher list". Add form fields: full name, subject or specialty, phone number, email. Save to localStorage under a teachers list. Teacher list is a table with edit and delete actions per row, delete asks for confirmation.

---

**Prompt 4.1 — Program + Training fields for teachers**

On the Add Teacher form, replace the "subject or specialty" field with two fields, same as the student form: a "Program" dropdown (options BTP, BTS, CAP) followed by a "Training" dropdown right after it. The Training options depend on which Program is selected, using the exact same mapping as students: CAP → "Gestion caissier", "Photographe". BTP → "Gestion informatique", "Développement web", "Design infographique". BTS → "Réseaux sécurité informatique", "Développement web mobile", "Gestion et finance". The Training dropdown is disabled and empty until a Program is picked, and resets whenever the Program changes. Save both values with the teacher record. Update the Teacher List table to show "Program" and "Training" columns instead of the old "specialty" column, placed right after Full Name.

---

**Prompt 4.2 — Search and filter on Teacher List**

On the Teacher List view, above the table, add a search bar and a "Filter" button on the same row — same layout as the Student List. The search bar searches by full name as the user types, matching against all currently loaded teachers. The Filter button opens a small dropdown panel with two filter fields: a "Program" dropdown (All, BTP, BTS, CAP) and a "Training" dropdown, whose options depend on the selected Program using the same mapping as the Add Teacher form — if Program is "All", show every training option from every program. Both the search text and the filter selections apply together, narrowing the same table. Show a small "Clear filters" link when any filter or search is active, which resets everything back to the full list.

---

**Prompt 5 — Pay page**

Build a payments page with three sections. First, an "add payment" form: a dropdown to pick a student (from the saved students list), amount, plan type (dropdown: one-time, semester, monthly), and date. On submit, save it to a payments list in localStorage. Second, a payments table listing all payments with student name, amount, plan type, and date, with a filter to search by student name. Third, two print actions per row: "print receipt" opens a clean full-page printable view with the student's name, program, amount, plan type, and date, then triggers the browser print dialog. "print ticket" opens a small, compact printable layout (sized like a small paper ticket/receipt) showing just the student name, amount, and date, then triggers print. Use separate print layouts for each.

---

**Prompt 5.1 — Student autocomplete, plus Program and Training on the Pay form**

On the Add Payment form, replace the student dropdown with a text input where the operator types the student's name directly instead of picking from a dropdown list. As they type, show a small list of matching students below the input (matching against saved students by name), and clicking a suggestion selects that student. Once a student is selected, automatically fill in and display their Program and Training (read-only, pulled from that student's saved record, not editable here) right below the name field, so the operator can confirm they picked the right student before recording the payment. Include the selected student's Program and Training in the saved payment record, and add both as columns in the payments table, placed after the student name column.

---

**Prompt 6 — Absence page**

Build an attendance page with two tabs: "Student attendance" and "Teacher attendance". Each tab has a date picker at the top. Below it, a list of all students (or teachers, depending on the tab) each with a present/absent toggle switch. A save button stores that day's attendance to localStorage, keyed by date, separately for students and teachers. If a date already has saved attendance, load and show the existing values when the date is picked.

---

**Prompt 6.1 — Filter and fix default toggle state on Absence**

Two changes to the Absence page. First, on both tabs, add a search bar and "Filter" button in the same row as the date picker, same pattern as the Students and Teachers pages: search by full name as the operator types, and a Filter panel with a "Program" dropdown (All, BTP, BTS, CAP) and a "Training" dropdown that depends on the selected Program, using the same mapping used everywhere else in the app. Both narrow the same attendance list together, with a "Clear filters" link when active. Second, fix the present/absent toggle default: right now every row loads pre-set to "present". Instead, when a date has no saved attendance yet, every toggle should start unmarked/off, and the operator has to actively mark each student or teacher present themselves — nothing should be assumed present by default.

---

**Prompt 7 — Publications page**

Build a publications/announcements page. A form with: title, message text area, recipient type (checkboxes: teachers, students — can select both), and channel (checkboxes: SMS, email, notification — can select more than one). On submit, save the announcement to localStorage with a timestamp and show a success confirmation message (no real message is actually sent, this just records it). Below the form, show a list/history of previously created publications with their title, date, and which recipients/channels were selected.
