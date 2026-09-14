# PRD — SSM (Student Manager System)

## 1. Problem
Training centers run registration, payment, courses, exams, and attendance on paper or spreadsheets. SSM digitizes all of it, with three roles each doing their own job in one system.

## 2. Roles and what each one does
| Role | Does |
|---|---|
| **Operator** (center staff) | Registers students, records payments, tracks attendance, manages teacher and student data |
| **Teacher** | Uploads courses, creates exams, enters exam ranks/grades |
| **Student** | Views courses, sees exam notes/grades |

All three roles are core to the product — this is not an ops-only tool with students bolted on later; it's a shared system where each role has a real, active job.

## 3. Core entities
- **User** — role: operator / teacher / student
- **Program** — e.g. BTP, BTS, CAP (operator-managed, not hardcoded)
- **Enrollment** — links a student to a program, has status
- **Payment** — linked to an enrollment, plan type (one-time / semester / monthly), status
- **Attendance** — per student, per session, present/absent
- **Course** — belongs to a program, created by a teacher
- **Lesson** — belongs to a course, type: doc / video
- **Exam** — belongs to a course, created by a teacher
- **Grade** — links a student to an exam, holds the rank/score

## 4. MVP scope (build in this order)
1. **Operator: register student** — create user, assign to program, create enrollment
2. **Operator: record payment** — mark payment against an enrollment, set plan type and status
3. **Operator: mark attendance** — per session, per student
4. **Teacher: manage courses** — create course, upload lesson (doc/video)
5. **Teacher: manage exams** — create exam, enter grades per student
6. **Student: view courses and grades** — read-only
7. **Operator dashboard** — students, enrollments, payment and attendance status at a glance

## 5. Out of scope for v1
- Student self-registration (operator creates all accounts)
- Automated recurring billing / payment gateway integration
- Certification generation
- Notifications / email

## 6. Success criteria for the prototype
- An operator can register a student, record a payment, and mark attendance
- A teacher can upload a course lesson and enter a grade for a student
- A student can log in and see their courses and grades
- All of it works without touching the database directly

## 7. Suggested stack
- Backend: NestJS + Postgres
- File storage: MinIO
- Frontend: React + shadcn/ui
- Deploy: existing k0s cluster
