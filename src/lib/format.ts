/**
 * Small display-only formatters shared by the people tables (Students,
 * Teachers). They never change what is stored: login still matches the raw
 * name, and the raw phone stays in the database.
 */

/**
 * `+216 XX XXX XXX` for Tunisian numbers (8 digits after the country code).
 * Anything else is left exactly as stored so no information is invented.
 */
export function formatPhone(phone: string): string {
  const raw = phone.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("216")) {
    return `+216 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return raw;
}

/**
 * Title-cases a person's name for display: `"ahmed BEN salem"` becomes
 * `"Ahmed Ben Salem"`. Hyphens and apostrophes keep their shape
 * (`"jean-pierre"` → `"Jean-Pierre"`, `"o'brien"` → `"O'Brien"`).
 */
export function formatPersonName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .split(/(\s+|-|')/)
    .map((part) => {
      if (part === "" || /^(\s+|-|')$/.test(part)) return part;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}
