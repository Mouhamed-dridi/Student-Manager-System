// Subjects a session can be scheduled under, and the rule that decides which
// teachers are qualified for one.
//
// There is no teacher↔subject table in this app: a teacher's subjects are
// whatever their courses (`courses.name`, scoped to the branch's training) and
// their free-text `teachers.specialty` mention. The match is deliberately
// forgiving — "Web Dev" has to find a course called "Web Development", and
// "Networking" has to find "Réseaux et sécurité informatique" — so accents and
// language are ignored. When nothing matches, callers show every teacher rather
// than an empty dropdown.

export const PLANNING_SUBJECTS = [
  "Web Dev",
  "Linux",
  "Networking",
  "English",
  "Arabic",
  "French",
  "Business",
] as const;

export type PlanningSubject = (typeof PLANNING_SUBJECTS)[number];

export function isPlanningSubject(value: string): value is PlanningSubject {
  return (PLANNING_SUBJECTS as readonly string[]).includes(value);
}

/**
 * Words that identify a subject inside a course name or a specialty. The
 * canonical label is always matched too; these only widen it.
 */
const SUBJECT_ALIASES: Record<PlanningSubject, string[]> = {
  "Web Dev": [
    "web dev",
    "web development",
    "developpement web",
    "web",
    "frontend",
    "front end",
    "react",
    "javascript",
  ],
  Linux: ["linux", "unix", "systeme", "exploitation", "bash"],
  Networking: [
    "networking",
    "network",
    "reseaux",
    "reseau",
    "cisco",
    "routing",
    "ip",
  ],
  English: ["english", "anglais"],
  Arabic: ["arabic", "arabe"],
  French: ["french", "francais", "français"],
  Business: [
    "business",
    "commerce",
    "gestion",
    "management",
    "marketing",
    "qualite",
  ],
};

/** Lowercase, accent-free, whitespace-collapsed text for substring matching. */
export function normalizeSubjectText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasesFor(subject: string): string[] {
  const canonical = normalizeSubjectText(subject);
  const aliases = isPlanningSubject(subject)
    ? SUBJECT_ALIASES[subject].map(normalizeSubjectText)
    : [];
  return [canonical, ...aliases].filter(Boolean);
}

function mentions(text: string | null | undefined, aliases: string[]): boolean {
  const normalized = normalizeSubjectText(text);
  if (!normalized) return false;
  return aliases.some((alias) => {
    // Short aliases ("ip", "web") would match inside unrelated words, so they
    // only count as whole words; longer ones match as a prefix so "Web Dev"
    // still finds "Web Development".
    if (alias.length >= 4) return normalized.includes(alias);
    return new RegExp(`(^| )${alias}( |$)`).test(normalized);
  });
}

export interface SubjectTeacherSources {
  /** The course catalog, all branches (`listTeacherCourses()`). */
  courses: { teacherId: string; name: string; trainingId?: string }[];
  /** Full roster, so a specialty-only match still counts. */
  teachers: { id: string; specialty?: string }[];
  /** Prefer this branch's own courses before falling back to the catalog. */
  trainingId?: string;
}

/**
 * Teacher ids qualified for `subject` in this branch. Branch courses win, so a
 * teacher who teaches the subject here is not diluted by another track; the
 * teachers' specialties are considered on every branch.
 */
export function qualifiedTeacherIds(
  subject: string | null | undefined,
  sources: SubjectTeacherSources,
): string[] {
  if (!subject) return [];
  const aliases = aliasesFor(subject);
  if (aliases.length === 0) return [];

  const ids = new Set<string>();
  const scoped = sources.trainingId
    ? sources.courses.filter((course) => course.trainingId === sources.trainingId)
    : sources.courses;
  const candidates = scoped.length > 0 ? scoped : sources.courses;
  for (const course of candidates) {
    if (course.teacherId && mentions(course.name, aliases)) {
      ids.add(course.teacherId);
    }
  }
  for (const teacher of sources.teachers) {
    if (mentions(teacher.specialty, aliases)) ids.add(teacher.id);
  }
  return [...ids];
}
