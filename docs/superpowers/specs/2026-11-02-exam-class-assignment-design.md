# Exam Class Assignment Design

## Intent

Students in `BTS · Réseaux et sécurité informatique` cannot see exams whose saved `program` and `training` are blank. Keep exams scoped to their class while preventing new unassigned exams and allowing existing blank records to be repaired.

## Goals and non-goals

- Require a complete teacher class assignment before uploading/saving an exam; show an actionable message when it is missing.
- Use the existing `teacherCourseAssignment()` source of truth for both new exams and repair of existing exams.
- Let a teacher repair their own blank-snapshot exams by editing and saving them after their class assignment is configured.
- Do not broaden student visibility, add a database migration, or introduce a separate user-selected class model.

## Approaches

- **Correct database rows only:** fast, but does not prevent recurrence.
- **Include unassigned exams in student results:** rejected because exams could appear to every class.
- **Validate the existing teacher assignment and reuse it for create/edit:** selected; it prevents empty snapshots and repairs affected records without changing the class-scoped student query.

## Constraints and implementation calls

- The live schema confirms `exams.program` and `exams.training` are text; student class values resolve to `programs.code` and `trainings.name`.
- Before changing assignment-related queries, confirm the live `teachers` and `courses` columns used by `teacherCourseAssignment()`; do not infer them from the checked-in schema.
- No migration is expected. If a teacher has no resolvable assignment, saving must fail clearly and explain that an operator needs to configure the teacher's class first.
- Keep current exact class filtering; never silently assign a blank exam or expose it across classes.
