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
