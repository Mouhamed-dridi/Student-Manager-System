# Exam Class Assignment Implementation Plan

> **For agentic workers:** Follow this plan task-by-task in the current session; do not delegate this small, coupled change.

**Goal:** Stop exams from being saved without a class snapshot and allow blank-snapshot exams to inherit the teacher's resolved class when edited.

**Architecture:** Keep `teacherCourseAssignment()` as the existing source of truth. Add a required-assignment helper in the API layer, use it before uploading a new exam attachment, and enforce it again in `upsertExam()` so all save paths write complete class snapshots.

**Tech Stack:** React 19, TypeScript, Supabase JS client, existing oxlint and TypeScript build checks.

**Spec:** `docs/superpowers/specs/2026-11-02-exam-class-assignment-design.md`

## Global Constraints

- Keep exact class-scoped student filtering; never show unassigned exams to all students.
- Confirm actual live `teachers` and `courses` columns used by class assignment before changing Supabase-querying code.
- Do not add a database migration or use guessed table columns.
- Report a clear, actionable error when a teacher has no resolvable class.
- Do not upload an attachment if the teacher's class cannot be resolved.

## Review Focus

- **Teacher has no assignment:** save is blocked before storage upload and reports that an operator must assign a class (Task 2).
- **Assignment values contain surrounding whitespace:** values are trimmed before writing the exam snapshot (Task 2).
- **Only one of program/training resolves:** save is blocked; partial snapshots are never written (Task 2).
- **Editing an existing exam with blank snapshots:** a valid teacher assignment fills both snapshot values on save (Task 2).
- **Valid class assignment:** create saves both class values and existing student filtering remains unchanged (Tasks 2–3).

---

### Task 1: Confirm live teacher assignment schema

**Files:**
- None; read-only Supabase SQL Editor inspection.

**Interfaces:**
- Consumes: confirmed live columns for `teachers` and `courses`.
- Produces: confirmed assignment columns and whether the affected teacher has a complete resolvable assignment.

- [ ] Check `information_schema.columns` for `teachers.program`, `teachers.training`, `teachers.specialty`, and `courses.teacher_id`, `courses.program_id`, `courses.training_id`.
- [ ] Inspect the affected teacher's class assignment values using only confirmed columns; do not include passwords or unrelated personal data.
- [ ] Do not begin Tasks 2–3 until the live columns are confirmed. If the assignment data itself is missing, record that an operator must configure it for the application path to resolve.

### Task 2: Require a complete class snapshot for every exam save

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `teacherCourseAssignment(teacherId: string)`.
- Produces: `requireTeacherExamAssignment(teacherId: string): Promise<{ program: string; training: string }>`; trims values and throws an actionable error unless both are non-empty.

- [ ] Implement `requireTeacherExamAssignment()` using the confirmed existing assignment fields and the current resolver.
- [ ] Update `upsertExam()` so when either `program` or `training` is blank, both values are replaced from `requireTeacherExamAssignment(exam.teacherId)`; fail instead of writing a partial or empty snapshot when the class cannot be resolved.
- [ ] Verify `upsertExam()` preserves snapshots only when both existing values are non-empty and writes the resolved pair together for blank or partial legacy rows.

### Task 3: Validate assignment before uploading new exam files

**Files:**
- Modify: `src/pages/teacher-portal/CreateExamView.tsx`

**Interfaces:**
- Consumes: `requireTeacherExamAssignment()` from Task 2.
- Produces: new exam submissions resolve their class before calling `uploadExamAttachment()` and pass that complete class snapshot to `upsertExam()`.

- [ ] Resolve the teacher assignment before uploading the required exam file.
- [ ] If resolution fails, display the API error through the existing `setError()` path and do not upload or save.
- [ ] On success, use the resolved values for the `program` and `training` passed to `upsertExam()`.

### Task 4: Verify behavior and project checks

**Files:**
- No additional files.

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: verified save behavior with no regression in student class filtering.

- [ ] With an unassigned teacher, attempt to create an exam and verify a clear error appears, no exam row is inserted, and no attachment is uploaded.
- [ ] With the teacher assigned to `BTS` / `Réseaux et sécurité informatique`, create an exam and verify both text snapshot fields are saved exactly; verify the affected students see it.
- [ ] Edit and save one existing blank-snapshot exam and verify both fields are populated from the teacher assignment.
- [ ] Run `npm run lint` and `npx tsc -b`; resolve failures caused by this change without altering unrelated pre-existing changes.
