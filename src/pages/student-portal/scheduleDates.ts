/**
 * Date helpers for the student Planning and Exams sections.
 *
 * `planning.date` and `exams.date` are plain "YYYY-MM-DD" strings. Comparing
 * those strings directly avoids the UTC-midnight shift that
 * `new Date("2026-10-21")` introduces in positive timezones, and keeps the
 * week boundaries in the student's local calendar.
 */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Monday-based, matching the teacher Planning page. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Parses "YYYY-MM-DD" as local midnight (returns null for blanks/garbage). */
export function parseDateKey(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}/.test(key)) return null;
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** "2026-10-21" -> "21 Oct 2026"; anything unparsable is returned as typed. */
export function formatLongDate(key: string | null | undefined): string {
  const date = parseDateKey(key);
  if (!date) return key?.trim() ? key : "—";
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Short label for the 7 cards of the week, e.g. "Mon 21". */
export function formatDayLabel(date: Date): string {
  return `${WEEKDAY_LABELS[(date.getDay() + 6) % 7]} ${date.getDate()}`;
}

/** "20 – 26 Oct 2026" (or "28 Sep – 4 Oct 2026" across a month boundary). */
export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const startLabel = `${start.getDate()} ${start.getMonth() === end.getMonth() ? "" : MONTH_LABELS[start.getMonth()] + " "}`;
  return `${startLabel}– ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${end.getFullYear()}`;
}
