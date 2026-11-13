-- Teacher portrait photos.
--
-- The operator teacher edit sheet uploads a portrait and stores the public URL
-- in two places:
--   * `user_profiles.avatar_url` — the source of truth (the portal headers and
--     both profile pages render from it);
--   * `teachers.avatar_url` — this column, a mirror so a reader that only has
--     the teachers row still resolves the photo.
--
-- `user_profiles` needs supabase/user-profiles-migration.sql and the bucket
-- policies of supabase/profile-picture-bucket-migration.sql (photos live in the
-- existing `profilePictuer` bucket, not `Logo` — that one is the center logo).
--
-- Idempotent: safe to re-run. The app probes the column at runtime, so a
-- database without this patch keeps working with initials avatars instead of
-- failing the upload.

alter table if exists public.teachers
  add column if not exists avatar_url text;
