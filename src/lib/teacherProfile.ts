// Teacher profile bits that live outside the database.
//
// The `teachers` table has no photo/avatar column and this app has no Supabase
// Auth (one shared anon key, no user metadata — see AGENTS.md), so a teacher's
// chosen photo cannot be stored server-side without a schema change. It lives
// in localStorage keyed by teacher id, like the other local-only preferences
// (`ssm-settings`, dashboard widgets, announcement reads):
//
//   ssm-teacher-avatar:<teacherId>
//
// Picking a file downscales it to a square JPEG data URL (<=256px) so several
// photos still fit comfortably in the storage quota; an external image URL is
// stored as-is. A custom window event keeps every mounted avatar (navbar, the
// settings preview) in sync without a reload, and the `storage` listener does
// the same across tabs.

import { useCallback, useSyncExternalStore } from "react";

const KEY_PREFIX = "ssm-teacher-avatar:";
const AVATAR_EVENT = "ssm-teacher-avatar-changed";
const AVATAR_MAX_PX = 256;

/** Dispatched after a successful profile save so the shell can re-read it. */
export const TEACHER_PROFILE_CHANGED_EVENT = "ssm-teacher-profile-changed";

export function teacherAvatarKey(teacherId: string): string {
  return `${KEY_PREFIX}${teacherId}`;
}

export function loadTeacherAvatar(teacherId?: string): string | null {
  if (!teacherId) return null;
  try {
    const value = localStorage.getItem(teacherAvatarKey(teacherId));
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Stores the avatar data URL/remote URL, or removes it when `value` is null. */
export function saveTeacherAvatar(
  teacherId: string,
  value: string | null,
): void {
  try {
    if (value) localStorage.setItem(teacherAvatarKey(teacherId), value);
    else localStorage.removeItem(teacherAvatarKey(teacherId));
  } catch {
    throw new Error(
      "The photo could not be saved in this browser. Try a smaller image or paste an image URL instead.",
    );
  }
  window.dispatchEvent(
    new CustomEvent(AVATAR_EVENT, { detail: { teacherId } }),
  );
}

export function subscribeTeacherAvatar(
  teacherId: string,
  listener: () => void,
): () => void {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ teacherId?: string }>).detail;
    // Ignore other teachers' updates (the settings page writes only its own).
    if (!detail || detail.teacherId === teacherId) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === teacherAvatarKey(teacherId)) listener();
  };
  window.addEventListener(AVATAR_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AVATAR_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive avatar for one teacher (null when unknown or not set). */
export function useTeacherAvatar(teacherId?: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) =>
      teacherId ? subscribeTeacherAvatar(teacherId, onChange) : () => {},
    [teacherId],
  );
  const getSnapshot = useCallback(
    () => loadTeacherAvatar(teacherId),
    [teacherId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// ------------------------------------------------------------ social links
//
// Same reasoning as the avatar: `teachers` has no linkedin/whatsapp/github
// columns, so the links a teacher enters in Settings are kept in this browser
// under ssm-teacher-social:<teacherId>. Nothing is uploaded.

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

/** Tells the shell to re-read the teacher record (new name/specialty). */
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("That file is not an image this browser can read."));
    image.src = src;
  });
}

/**
 * Turns a picked file into a centered, square JPEG data URL small enough to
 * keep in localStorage. Throws a user-facing message when the file is not a
 * decodable image.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (PNG, JPEG or WebP).");
  }
  const image = await loadImage(await readFileAsDataUrl(file));
  const side = Math.min(image.width, image.height);
  if (!side) throw new Error("That image could not be read.");

  const size = Math.min(AVATAR_MAX_PX, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image.");

  // White background so transparent PNGs do not turn black in a JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL("image/jpeg", 0.85);
}
