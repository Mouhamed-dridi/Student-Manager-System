/**
 * Colour coding for planning subjects.
 *
 * Subjects are free text (`planning.course`), so the tone is derived from the
 * name itself: the same subject keeps the same colour in every view and every
 * week without an extra table or column. The palette stays muted so it reads
 * inside the monochrome layout instead of fighting it.
 */

export interface SubjectTone {
  /** Left border for cards, e.g. `border-l-sky-500`. */
  border: string;
  /** Very light wash for the card body. */
  bg: string;
  /** Small filled square for legends and day lists. */
  dot: string;
  /** Chip/badge styling when the subject is shown inline. */
  chip: string;
}

const TONES: SubjectTone[] = [
  {
    border: "border-l-sky-500",
    bg: "bg-sky-500/5",
    dot: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
  },
  {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  },
  {
    border: "border-l-violet-500",
    bg: "bg-violet-500/5",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-100",
  },
  {
    border: "border-l-rose-500",
    bg: "bg-rose-500/5",
    dot: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100",
  },
  {
    border: "border-l-teal-500",
    bg: "bg-teal-500/5",
    dot: "bg-teal-500",
    chip: "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-100",
  },
];

/** Deterministic tone for a subject name; blank subjects get the first tone. */
export function subjectTone(course: string | null | undefined): SubjectTone {
  const key = (course ?? "").trim().toLocaleLowerCase();
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return TONES[hash % TONES.length];
}
