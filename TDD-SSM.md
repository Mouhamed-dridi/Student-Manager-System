# TDD — SSM (Student Manager System) — Prototype v1

## 1. Architecture overview
```
React (shadcn/ui)  --->  NestJS API (REST + JWT)  --->  Postgres
                                |
                                +--> MinIO (file storage: docs/videos)
```
Single backend service, single database. No microservices for v1 — one deployable unit.

## 2. Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + shadcn/ui | matches your existing projects |
| Backend | NestJS (Node.js) | structured modules, built-in guards for roles |
| DB | Postgres | relational fit for enrollments/payments/grades |
| File storage | MinIO | self-hosted, already used in [[local-upload]] |
| Auth | JWT (access + refresh token) | simple, stateless |
| Deploy | Docker containers on your k0s cluster | no managed services needed for prototype |

## 3. Roles and access
Three roles on the `user` table: `operator`, `teacher`, `student`.
Every API route is protected by a `RolesGuard` reading the JWT payload's `role` claim. No separate permission tables in v1 — role-based only.

## 4. Database schema (Postgres DDL)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('operator','teacher','student')),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id),
  program_id UUID REFERENCES programs(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('one_time','semester','monthly')),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id),
  session_date DATE NOT NULL,
  present BOOLEAN NOT NULL,
  UNIQUE(student_id, session_date)
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  teacher_id UUID REFERENCES users(id),
  title TEXT NOT NULL
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('doc','video')),
  file_url TEXT NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  title TEXT NOT NULL,
  exam_date DATE
);

CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id),
  student_id UUID REFERENCES users(id),
  score NUMERIC(5,2) NOT NULL,
  UNIQUE(exam_id, student_id)
);
```

## 5. API endpoints (v1)
| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | all | login, returns JWT |
| POST | `/students` | operator | register a student |
| POST | `/enrollments` | operator | enroll student in program |
| POST | `/payments` | operator | record a payment |
| POST | `/attendance` | operator | mark attendance |
| GET | `/students/:id` | operator, student(self) | view student profile |
| POST | `/courses` | teacher | create course |
| POST | `/lessons` | teacher | upload lesson (doc/video) |
| POST | `/exams` | teacher | create exam |
| POST | `/grades` | teacher | enter grade |
| GET | `/my-courses` | student | list enrolled courses + lessons |
| GET | `/my-grades` | student | list own grades |

## 6. Backend folder structure
```
src/
  auth/          login, JWT strategy, RolesGuard
  users/         user CRUD, role handling
  programs/
  enrollments/
  payments/
  attendance/
  courses/
  lessons/       upload to MinIO, return file_url
  exams/
  grades/
  common/        guards, decorators, dto base classes
```

## 7. Frontend structure
```
src/
  pages/
    operator/    register-student, payments, attendance, dashboard
    teacher/     courses, upload-lesson, exams, grades
    student/     my-courses, my-grades
  components/    shared shadcn/ui components
  lib/api.ts     API client, attaches JWT
  lib/auth.ts    login, token storage, role check
```
Route guarding: redirect based on `role` from JWT after login — three separate route trees, no shared operator/teacher/student pages in v1.

## 8. Build order (matches PRD MVP order)
1. Auth + users + roles
2. Operator: programs, student registration, enrollment
3. Operator: payments, attendance
4. Teacher: courses, lessons (MinIO upload)
5. Teacher: exams, grades
6. Student: my-courses, my-grades views
7. Operator dashboard (aggregates everything above)

## 9. Out of scope for v1
- Automated billing / payment gateway
- Notifications
- File preview/streaming optimization (basic upload/download link only)
- Multi-center / multi-tenant support (single center per deployment for now)
