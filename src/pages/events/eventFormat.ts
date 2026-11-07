// Presentation helpers shared by the event form and the event history page.
// Kept in one place so a partner link renders identically in the form's
// dynamic list and in the history table.

/**
 * The gift categories offered by the event creator. Stored as the lowercase
 * value in `events.gifts_awards`; `formatGift` turns it back into a readable
 * label for the teacher detail page.
 */
export const GIFT_OPTIONS = [
  { value: "money", label: "Money" },
  { value: "certfaction", label: "Certification" },
  { value: "gadget", label: "Gadget" },
  { value: "other", label: "Other" },
] as const;

/** Readable label for a stored gift value; unknown/legacy text is shown as-is. */
export function formatGift(value: string): string {
  if (!value) return "";
  const match = GIFT_OPTIONS.find(
    (option) => option.value === value.trim().toLowerCase(),
  );
  return match ? match.label : value;
}

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

/** One 24h "HH:mm" clock value rendered in the visitor's locale. */
function formatClock(hours: string, minutes: string): string {
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Formats the stored `event_time` text.
 *
 * The operator form keeps a start and an end time (plus the timezone) in the
 * one text column, as `"09:00 - 17:00 (Africa/Casablanca)"`. Legacy rows hold a
 * single `"HH:mm"`. Both are read here, so the history table and the teacher
 * detail page render the window instead of "Invalid Date".
 */
export function formatTime(value: string): string {
  if (!value) return "—";
  const match = value.match(
    /(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/,
  );
  if (!match) return value;
  const start = formatClock(match[1], match[2]);
  if (!match[3] || !match[4]) return start;
  return `${start} – ${formatClock(match[3], match[4])}`;
}

/** Splits the stored `event_time` text back into the form's three fields. */
export function parseEventTime(value: string): {
  startTime: string;
  endTime: string;
  timezone: string;
} {
  const timezone = value.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? "";
  const match = value.match(
    /(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/,
  );
  const pad = (part: string) => part.padStart(2, "0");
  return {
    startTime: match ? `${pad(match[1])}:${match[2]}` : "",
    endTime: match?.[3] && match[4] ? `${pad(match[3])}:${match[4]}` : "",
    timezone,
  };
}

/**
 * Joins the form's start/end/timezone into the single `event_time` text column.
 * `"09:00"` alone stays a bare clock value so older readers keep working.
 */
export function composeEventTime(
  startTime: string,
  endTime: string,
  timezone: string,
): string {
  if (!startTime) return "";
  const range = endTime ? `${startTime} - ${endTime}` : startTime;
  return timezone ? `${range} (${timezone})` : range;
}

/** "start – end", collapsing to a single day when both are the same. */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const start = formatDay(startsOn);
  if (!endsOn || endsOn === startsOn) return start;
  return `${start} – ${formatDay(endsOn)}`;
}
