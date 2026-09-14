// Tiny cookie helpers that replace localStorage for session state.
// Cookies are sent with every request but carry only tiny opaque values
// (a role string and two UUIDs), so the overhead is negligible.

function setCookie(key: string, value: string) {
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
}

function getCookie(key: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function removeCookie(key: string) {
  document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
}

// ----- role ----------------------------------------------------------

export function getRole(): string | null {
  return getCookie("role");
}

export function setRole(role: string) {
  setCookie("role", role);
}

// ----- person ids ----------------------------------------------------

export function getCurrentStudentId(): string | null {
  return getCookie("currentStudentId");
}

export function setCurrentStudentId(id: string) {
  setCookie("currentStudentId", id);
}

export function getCurrentTeacherId(): string | null {
  return getCookie("currentTeacherId");
}

export function setCurrentTeacherId(id: string) {
  setCookie("currentTeacherId", id);
}

// ----- bulk helpers --------------------------------------------------

export function clearSession() {
  removeCookie("role");
  removeCookie("currentStudentId");
  removeCookie("currentTeacherId");
}
