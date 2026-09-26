// Presentation helpers shared by the course card grid and the course detail
// view, so both render a course identically (thumbnail fallback + date format).

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

/** Static per-training image used when a course has no uploaded thumbnail. */
export function thumbnailForTraining(training: string): string | null {
  const suffix = `/${trainingSlug(training)}.jpg`;
  const entry = Object.entries(trainingThumbnails).find(([path]) =>
    path.endsWith(suffix),
  );
  return entry?.[1] ?? null;
}

/** `published_at` timestamp rendered as "Added Sep 25, 2026". */
export function formatPublished(published: string): string {
  return new Date(published).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
