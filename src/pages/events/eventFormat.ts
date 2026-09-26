// Presentation helpers shared by the event form and the event history page.
// Kept in one place so a partner link renders identically in the form's
// dynamic list and in the history table.

/** A partner entry is a link; anything else is treated as plain text. */
export function asLink(value: string): string | null {
  return /^https?:\/\/\S+$/i.test(value) ? value : null;
}

/**
 * Formats a yyyy-mm-dd date for display. A bare date string is parsed as UTC
 * midnight by `new Date()`, which renders as the *previous* day in a
 * negative-offset timezone, so the parts are built into a local date instead.
 */
export function formatDay(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString();
}

/** Formats a 24h "HH:mm" value as a localised time. */
export function formatTime(value: string): string {
  if (!value) return "—";
  const [h, min] = value.split(":").map(Number);
  if (h === undefined || min === undefined) return value;
  const date = new Date();
  date.setHours(h, min, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "start – end", collapsing to a single day when both are the same. */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const start = formatDay(startsOn);
  if (!endsOn || endsOn === startsOn) return start;
  return `${start} – ${formatDay(endsOn)}`;
}
