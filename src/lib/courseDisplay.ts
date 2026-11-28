// Presentation helpers shared by the course card grid and the course detail
// view, so both render a course identically (thumbnail fallback + date format).
//
// Covers are public Storage objects (cours-covers bucket, teacher uploads are
// encoded at up to 1200px / quality 0.85) served through getPublicUrl. No
// render/image transformation is requested, so the original object is always
// the source — there is no upscaled or re-compressed URL to blur the card.

import courseCoverFallback from "../assets/img/courses/course-cover-fallback.svg";

const trainingThumbnails = import.meta.glob("../assets/img/courses/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// "Réseaux et sécurité informatique" -> reseaux-et-securite-informatique
// Apostrophes become dashes too: "Comptable d'entreprise" -> comptable-d-entreprise
function trainingSlug(training: string): string {
  return training
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['\u2019\s]+/g, "-");
}

/**
 * Static per-training image used when a course has no uploaded thumbnail.
 * Falls back to the bundled 1600×1000 (16:10) zinc cover so a card never shows
 * a blank/low-resolution placeholder.
 */
export function thumbnailForTraining(training: string): string {
  const suffix = `/${trainingSlug(training)}.jpg`;
  const entry = Object.entries(trainingThumbnails).find(([path]) =>
    path.endsWith(suffix),
  );
  return entry?.[1] ?? courseCoverFallback;
}

/**
 * Case-, accent- and punctuation-insensitive key for course/support and class
 * names, so a filter or a class comparison does not depend on how the row was
 * typed ("Réseaux & Sécurité" === "reseaux-securite"). Never empty when the
 * input has at least one letter or digit.
 */
export function normalizeCourseName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// The planification and the branch material catalog do not always spell a
// language the same way ("Anglais" vs "English"), so both sides are folded to
// one canonical token before they are compared. Without this, the dropdown
// listed the same matière twice and a course tagged "English" never counted
// under the branch's "Anglais" material.
const SUBJECT_ALIASES: Record<string, string> = {
  anglais: "anglais",
  english: "anglais",
  francais: "francais",
  french: "francais",
};

/**
 * Normalized, alias-folded key for a subject name. Used to deduplicate the
 * matière options and to compare a course against a material, so
 * "Anglais"/"English" and "Français"/"French" are one subject.
 */
export function subjectAliasKey(value: string | null | undefined): string {
  return normalizeCourseName(value)
    .split(" ")
    .map((token) => SUBJECT_ALIASES[token] ?? token)
    .join(" ");
}

/**
 * Whether two subject names refer to the same matière. Normalized equality is
 * the common case; a whole-word extension also matches so a course titled
 * "Anglais technique" still belongs to the scheduled subject "Anglais". A
 * short fragment (under four characters) never matches by containment, which
 * keeps an accidental "art" from swallowing "arts plastiques".
 */
export function subjectNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = subjectAliasKey(a);
  const right = subjectAliasKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 4) return false;
  return new RegExp(`(^| )${shorter}( |$)`).test(longer);
}

/**
 * Alias-folded key for a branch material, one step stricter than
 * `subjectAliasKey()`: ERP and SAP name the same discipline in a class file
 * ("ERP Consulting" / "SAP consulting"), so a subject option list offers it
 * once. Deliberately separate from `subjectAliasKey()` — class names are
 * compared with that one, and folding SAP into ERP there would make two
 * genuinely different classes look identical.
 */
export function materialAliasKey(value: string | null | undefined): string {
  return subjectAliasKey(value)
    .split(" ")
    .map((token) => (token === "sap" || token === "erp" ? "erp" : token))
    .join(" ");
}

/** Whether two branch materials / subjects are the same matière to schedule. */
export function materialNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (materialAliasKey(a) === materialAliasKey(b)) {
    return materialAliasKey(a) !== "";
  }
  return subjectNamesMatch(a, b);
}

/** `published_at` timestamp rendered as "Added Sep 25, 2026". */
export function formatPublished(published: string): string {
  return new Date(published).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Stable identity for a scheduled course. Teacher-created rows have a database
 * `id`; the statically seeded schedule entries (src/lib/trainings.ts COURSES)
 * have none, so they are identified by name + slot instead.
 *
 * Never compare seeded courses on `id` alone: every one of them is `undefined`,
 * so an `=== undefined` test matches the first seeded course in the list and
 * silently swaps whichever course is open.
 */
export function courseKey(course: {
  id?: string;
  name: string;
  day?: string;
  time?: string;
}): string {
  return course.id ?? `${course.name}-${course.day ?? ""}-${course.time ?? ""}`;
}
