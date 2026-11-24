import { listTeacherCourses } from "@/lib/api";
import { subjectNamesMatch } from "@/lib/courseDisplay";

export const PROGRAMS = ["BTP", "BTS", "CAP"] as const;

export type Program = (typeof PROGRAMS)[number];

export const TRAININGS: Record<Program, string[]> = {
  CAP: ["Agent d'entrepôt", "Vendeur caissier étalagiste"],
  BTP: [
    "Préparateur en Pharmacie",
    "Technicien de Soutien en Informatique de Gestion",
    "Comptable d'entreprise",
    "Décoration et Design d'intérieur",
  ],
  BTS: [
    "Maintenance industrielle",
    "Commerce international",
    "Contrôle qualité",
    "Comptable d'entreprise",
    "Développement web",
    "Réseaux et sécurité informatique",
  ],
};

export interface ScheduledCourse {
  name: string;
  /** Optional now: teacher-created courses carry no manual schedule slot. */
  day?: string;
  time?: string;
}

// Prototype schedule data: courses offered per program and training.
export const COURSES: Record<Program, Partial<Record<string, ScheduledCourse[]>>> = {
  CAP: {
    "Gestion caissier": [
      { name: "Cash Register Fundamentals", day: "Monday", time: "08:30–10:30" },
      { name: "Customer Service & Sales", day: "Wednesday", time: "10:45–12:45" },
      { name: "Accounting Software Lab", day: "Friday", time: "14:00–16:00" },
    ],
    Photographe: [
      { name: "Camera & Exposure Basics", day: "Tuesday", time: "08:30–10:30" },
      { name: "Studio Lighting Workshop", day: "Thursday", time: "14:00–17:00" },
      { name: "Photo Editing Lab", day: "Saturday", time: "09:00–11:00" },
    ],
  },
  BTP: {
    "Gestion informatique": [
      { name: "Office Automation Tools", day: "Monday", time: "08:00–10:00" },
      { name: "Database Management", day: "Wednesday", time: "13:00–15:00" },
      { name: "IT Support Practice", day: "Friday", time: "10:15–12:15" },
    ],
    "Développement web": [
      { name: "HTML & CSS Foundations", day: "Monday", time: "10:30–12:30" },
      { name: "JavaScript Essentials", day: "Tuesday", time: "14:00–16:00" },
      { name: "Responsive Web Project", day: "Thursday", time: "08:30–11:30" },
    ],
    "Design infographique": [
      { name: "Graphic Design Principles", day: "Tuesday", time: "08:30–10:30" },
      { name: "Adobe Suite Workshop", day: "Thursday", time: "14:00–16:30" },
      { name: "Branding Mini-Project", day: "Friday", time: "13:00–15:00" },
    ],
  },
  BTS: {
    "Réseaux sécurité informatique": [
      { name: "Network Protocols", day: "Monday", time: "08:00–11:00" },
      { name: "System Administration", day: "Wednesday", time: "14:00–16:00" },
      { name: "Cybersecurity Fundamentals", day: "Friday", time: "08:30–10:30" },
    ],
    "Développement web mobile": [
      { name: "Mobile UI Development", day: "Tuesday", time: "10:30–12:30" },
      { name: "REST APIs & Integration", day: "Thursday", time: "08:00–10:00" },
      { name: "Cross-Platform App Project", day: "Friday", time: "14:00–17:00" },
    ],
    "Gestion et finance": [
      { name: "Financial Accounting", day: "Monday", time: "14:00–16:00" },
      { name: "Management Control", day: "Wednesday", time: "08:30–10:30" },
      { name: "Business Economics", day: "Thursday", time: "10:45–12:45" },
    ],
  },
};

export interface CourseMaterial {
  name: string;
  type: string;
  /** Supabase Storage public URL of the uploaded file (present once attached). */
  url?: string;
}

/** Optional course-detail metadata, shown in the student's Coursera-style view. */
export interface CourseDetails {
  /** One-line hook under the course title. */
  subtitle?: string;
  /** Difficulty as a display string: Beginner | Intermediate | Expert. */
  level?: string;
  /** Estimated length as a display string, e.g. "1h 30m". */
  duration?: string;
  /** Delivery format, e.g. "Video", "Document" or "Video & Document". */
  format?: string;
  /** "Skills you'll gain" competencies. */
  skills?: string[];
  /** Free-text syllabus, one topic per line. */
  syllabus?: string;
}

export interface TeacherCourseRecord extends CourseDetails {
  id: string;
  teacherId: string;
  /** Material (matière) the course is taught under, e.g. "ERP Consulting". */
  subject?: string;
  program: string;
  training: string;
  programId?: string;
  trainingId?: string;
  name: string;
  description?: string;
  day?: string;
  time?: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

export interface ScheduledCourseView extends ScheduledCourse, CourseDetails {
  id?: string;
  teacherId?: string;
  /** Material (matière) the course is taught under, e.g. "ERP Consulting". */
  subject?: string;
  program?: string;
  training?: string;
  programId?: string;
  trainingId?: string;
  description?: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

// Teacher-created courses are scoped to the teacher's class. Prefer matching
// by the real foreign keys (program_id/training_id); fall back to the joined
// program/training NAME text, normalized so case, accents and punctuation do
// not hide a course ("Réseaux & Sécurité" vs "reseaux-securite").
//
// A course belongs to a student's class when the training FK agrees (which
// implies its program) or the resolved names agree after normalization. Names
// are compared with whole-word matching rather than byte equality: a stored
// "BTS — Commerce international" must still reach the student whose training is
// "Commerce international (BTS)". A missing name on either side is unknown, not
// a mismatch, so a legacy row whose FK was never backfilled still reaches the
// student whose training matches.
function courseInClass(
  c: TeacherCourseRecord,
  program: string,
  training: string,
  assignment?: { programId?: string; trainingId?: string },
): boolean {
  if (assignment?.trainingId && c.trainingId === assignment.trainingId) {
    return true;
  }
  if (!program.trim() || !training.trim()) return false;
  if (!subjectNamesMatch(c.training, training)) return false;
  return !c.program.trim() || subjectNamesMatch(c.program, program);
}

// A subject named in the planification may be taught in several BTS
// specializations, so the course row's training scope cannot be required to
// match. Its program tier still must (or be unknown on legacy rows), otherwise
// a generic subject like "Anglais" would also pull in every other program's
// course with the same name.
function courseSharesProgram(
  c: TeacherCourseRecord,
  program: string,
): boolean {
  if (!program.trim() || !c.program.trim()) return true;
  return subjectNamesMatch(c.program, program);
}

// Seeded entries carry no id/teacherId; teacher-created ones do.
// Teacher-created courses come from Supabase, so this is async now.
// The class of the student (program_id/training_id) is used as a server-side
// filter when both FKs exist; otherwise ALL course rows are fetched and the
// robust name comparison above picks the matches.
//
// `scheduledSubjects` is the student's planification: every distinct matière
// scheduled for their class. A transverse subject (Arabic, English, ...) is
// often attached to another BTS specialization while still being taught to
// this class, so a course row whose title matches a scheduled subject is kept
// even when its program/training scope points elsewhere. Without this, the
// student only saw the courses scoped to their one specialization.
//
// `classMaterials` are the materials (matières) of the student's class and
// `classTeacherIds` the teachers assigned to them. They are the strongest
// signal available: a course belongs to this class when its teacher is the one
// assigned a material here, even if the row was stamped with another
// program/training (ERP Consulting is a Commerce international material, but
// the teacher's profile may resolve to the IT-support class). Without this,
// such a course was silently dropped before the page could attribute it to its
// material.
export async function loadScheduledCourses(
  program: string,
  training: string,
  assignment?: {
    programId?: string;
    trainingId?: string;
    scheduledSubjects?: string[];
    classMaterials?: string[];
    classTeacherIds?: string[];
  },
): Promise<ScheduledCourseView[]> {
  const seeded: ScheduledCourseView[] =
    COURSES[program as Program]?.[training] ?? [];
  // Fetch the whole shared `courses` table and filter here. A server-side
  // program_id/training_id filter silently hides legacy teacher rows whose FKs
  // are NULL even when their joined names match the student's class — the
  // teacher's Cours module lists those rows, so the student must see them too.
  const addedRows = await listTeacherCourses();
  // TeacherCourseRecord and ScheduledCourseView declare the same field set, so
  // a live course row carries straight across. This used to be an explicit
  // destructure-and-rebuild allow-list, which silently dropped any field added
  // to the course record later — it ate the whole CourseDetails block
  // (subtitle/level/duration/format/skills/syllabus) before it could reach the
  // student view. The cast below still fails to compile if the two shapes ever
  // diverge.
  const scheduledSubjects = assignment?.scheduledSubjects ?? [];
  const classMaterials = assignment?.classMaterials ?? [];
  const classTeacherIds = new Set(
    (assignment?.classTeacherIds ?? []).filter((id) => id.trim() !== ""),
  );
  const added = addedRows.filter(
    (c) =>
      courseInClass(c, program, training, assignment) ||
      (c.teacherId !== "" && classTeacherIds.has(c.teacherId)) ||
      classMaterials.some((material) =>
        subjectNamesMatch(c.subject ?? "", material),
      ) ||
      (courseSharesProgram(c, program) &&
        scheduledSubjects.some(
          (subject) =>
            subjectNamesMatch(c.name, subject) ||
            subjectNamesMatch(c.subject ?? "", subject),
        )),
  ) as ScheduledCourseView[];
  return [...seeded, ...added];
}
