// Teacher-side profile state that is not part of the `teachers` row.
//
// Avatars used to live here as base64 data URLs in localStorage. They now go to
// the `profilePictuer` Storage bucket and the public URL is stored in
// `user_profiles.avatar_url` (see `src/lib/api.ts` and
// `src/lib/userProfile.ts`), so this module only keeps what still has no
// server column:
//
//   ssm-teacher-social:<teacherId>   LinkedIn / WhatsApp / GitHub links
//
// The links are written back to `user_profiles` too; the localStorage copy is a
// fallback for browsers that cannot reach the table. A custom window event tells
// the shell to re-read the teacher record after a profile save.

/** Dispatched after a successful profile save so the shell can re-read it. */
export const TEACHER_PROFILE_CHANGED_EVENT = "ssm-teacher-profile-changed";

// ------------------------------------------------------------ social links

const SOCIAL_KEY_PREFIX = "ssm-teacher-social:";

export interface TeacherSocialLinks {
  linkedin: string;
  whatsapp: string;
  github: string;
}

export const EMPTY_TEACHER_SOCIAL_LINKS: TeacherSocialLinks = {
  linkedin: "",
  whatsapp: "",
  github: "",
};

export function teacherSocialKey(teacherId: string): string {
  return `${SOCIAL_KEY_PREFIX}${teacherId}`;
}

/** Stored links for one teacher; blanks when absent or unreadable. */
export function loadTeacherSocialLinks(
  teacherId?: string,
): TeacherSocialLinks {
  if (!teacherId) return { ...EMPTY_TEACHER_SOCIAL_LINKS };
  try {
    const raw = localStorage.getItem(teacherSocialKey(teacherId));
    if (!raw) return { ...EMPTY_TEACHER_SOCIAL_LINKS };
    const parsed: unknown = JSON.parse(raw);
    const record =
      parsed && typeof parsed === "object"
        ? (parsed as Partial<TeacherSocialLinks>)
        : {};
    return {
      linkedin: typeof record.linkedin === "string" ? record.linkedin : "",
      whatsapp: typeof record.whatsapp === "string" ? record.whatsapp : "",
      github: typeof record.github === "string" ? record.github : "",
    };
  } catch {
    return { ...EMPTY_TEACHER_SOCIAL_LINKS };
  }
}

/** Trims and stores the links, or clears the entry when all three are blank. */
export function saveTeacherSocialLinks(
  teacherId: string,
  links: TeacherSocialLinks,
): void {
  const next: TeacherSocialLinks = {
    linkedin: links.linkedin.trim(),
    whatsapp: links.whatsapp.trim(),
    github: links.github.trim(),
  };
  try {
    if (!next.linkedin && !next.whatsapp && !next.github) {
      localStorage.removeItem(teacherSocialKey(teacherId));
    } else {
      localStorage.setItem(teacherSocialKey(teacherId), JSON.stringify(next));
    }
  } catch {
    throw new Error(
      "The social links could not be saved in this browser. Free up some storage and try again.",
    );
  }
}

/** Tells the shell to re-read the teacher record (new name). */
export function notifyTeacherProfileChanged(): void {
  window.dispatchEvent(new Event(TEACHER_PROFILE_CHANGED_EVENT));
}
export function subscribeTeacherProfileChanged(
  listener: () => void,
): () => void {
  window.addEventListener(TEACHER_PROFILE_CHANGED_EVENT, listener);
  return () =>
    window.removeEventListener(TEACHER_PROFILE_CHANGED_EVENT, listener);
}
