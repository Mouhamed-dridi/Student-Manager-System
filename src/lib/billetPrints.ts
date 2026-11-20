/**
 * How many times each archived absence billet was printed, remembered locally.
 *
 * The `absence_billets` table has no print column and the archive is a
 * read-only snapshot, so no query is issued for this: the counter lives in
 * `localStorage` and is keyed by the ticket's verification code. It is a
 * per-browser convenience (the "already printed" hint in the archive table),
 * never part of the ticket itself.
 */

const STORAGE_KEY = "ssm-billet-prints";

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const counts: Record<string, number> = {};
    for (const [code, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        counts[code] = Math.floor(value);
      }
    }
    return counts;
  } catch {
    return {};
  }
}

/** Every stored print count, keyed by billet code. */
export function loadBilletPrintCounts(): Record<string, number> {
  return read();
}

/** Print count already recorded for one billet code (0 when never printed). */
export function billetPrintCount(code: string): number {
  return read()[code] ?? 0;
}

/** Records one print of `code` and returns its new count. */
export function recordBilletPrint(code: string): number {
  if (!code) return 0;
  const counts = read();
  const next = (counts[code] ?? 0) + 1;
  counts[code] = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Private mode / quota: the hint is optional, printing must still work.
  }
  return next;
}
