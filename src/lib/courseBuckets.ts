// Which Supabase Storage bucket each piece of course media belongs in, and the
// media-type classification that decides it. One source of truth shared by the
// upload path (lib/api.ts) and the display path (components/courseMaterial.tsx)
// so a file can never be written to one bucket and previewed as if it were in
// another.
//
// Buckets are public, so an upload returns a plain public URL of the form
// /storage/v1/object/public/<bucket>/<path> — the bucket name is baked into the
// URL by getPublicUrl, which is what the student course detail renders.
//
// The legacy single `cours` bucket still holds the thumbnail_url of every
// course row saved before this split. Those URLs are absolute and keep working,
// so the bucket is retained (see supabase/schema.sql) and existing rows need no
// migration.

export const COURSE_COVERS_BUCKET = "cours-covers";
export const COURSE_PDF_BUCKET = "cours-PDF";
export const COURSE_VIDEOS_BUCKET = "cours-videos";

const VIDEO_EXTENSION = /\.(mp4|m4v|webm|ogv|mov)$/i;
const PDF_EXTENSION = /\.pdf$/i;

export type MaterialKind = "video" | "pdf" | "file";

/**
 * Classifies a file by MIME type, falling back to its extension. Browsers do
 * not always report a MIME type for a picked file, so the name is checked too.
 */
export function materialKind(name: string, type?: string): MaterialKind {
  const mime = (type ?? "").toLowerCase();
  if (mime.startsWith("video/") || VIDEO_EXTENSION.test(name)) return "video";
  if (mime === "application/pdf" || PDF_EXTENSION.test(name)) return "pdf";
  return "file";
}

/** The bucket a material of this name/MIME type must be uploaded to. */
export function bucketForMaterial(name: string, type?: string): string {
  switch (materialKind(name, type)) {
    case "video":
      return COURSE_VIDEOS_BUCKET;
    case "pdf":
      return COURSE_PDF_BUCKET;
    default:
      // Course thumbnails/covers are the only non-video, non-PDF upload.
      return COURSE_COVERS_BUCKET;
  }
}
