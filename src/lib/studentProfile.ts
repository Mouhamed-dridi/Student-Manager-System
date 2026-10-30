// Student-side profile state that is not part of the `students` row.
//
// Avatars used to be base64 data URLs in localStorage (`ssm-student-avatar:`).
// They now upload to the `profilePictuer` Storage bucket and the public URL is
// stored in `user_profiles.avatar_url`, so nothing image-related lives here any
// more — only the event that tells the student shell to re-read the record after
// a name change.

/** Dispatched after a successful profile save so the shell can re-read it. */
export const STUDENT_PROFILE_CHANGED_EVENT = "ssm-student-profile-changed";

/** Tells the shell to re-read the student record (new name). */
export function notifyStudentProfileChanged(): void {
  window.dispatchEvent(new Event(STUDENT_PROFILE_CHANGED_EVENT));
}

export function subscribeStudentProfileChanged(
  listener: () => void,
): () => void {
  window.addEventListener(STUDENT_PROFILE_CHANGED_EVENT, listener);
  return () =>
    window.removeEventListener(STUDENT_PROFILE_CHANGED_EVENT, listener);
}
