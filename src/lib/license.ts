// License metadata behind the operator Settings > License tab.
//
// There is no licensing backend: the activation date is a `license_activated_at`
// settings row and the term is a fixed number of months, so the expiry is always
// derived. Renewing stamps a fresh activation date, which pushes the expiry out
// by one term.
//
// Replace the SUPPORT_* placeholders with the center's real contacts.

export const LICENSE_TERM_MONTHS = 12;

export const SUPPORT_EMAIL = "support@example.com";
export const SUPPORT_PHONE = "+00 00 00 00 00";

/**
 * The active license key issued for this deployment, shown in Settings >
 * License. Static until a real licensing server takes over, at which point it
 * should be read from the issued license rather than hardcoded.
 */
export const LICENSE_TOKEN = "SSM-2026-PROD-7K4M";

export type LicenseStatus = "active" | "expired";

/** Local midnight today, so day maths never drifts across a timezone offset. */
function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Adds whole months and clamps to the last valid day of the target month, since
 * `setMonth` overflows instead of clamping (Jan 31 + 1 month becomes Mar 3).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) result.setDate(0);
  return result;
}

/**
 * Start of the current term. A center that has never activated (a fresh install)
 * starts today, so it reads as a full year rather than an expired license.
 */
export function licenseTermStart(
  activatedAt?: string | null,
  now: Date = new Date(),
): Date {
  if (!activatedAt) return startOfToday(now);
  const parsed = new Date(activatedAt);
  return Number.isNaN(parsed.getTime()) ? startOfToday(now) : parsed;
}

/** Activation date plus one term. */
export function licenseExpiry(
  activatedAt?: string | null,
  now: Date = new Date(),
): Date {
  return addMonths(licenseTermStart(activatedAt, now), LICENSE_TERM_MONTHS);
}

export function licenseStatus(
  activatedAt?: string | null,
  now: Date = new Date(),
): LicenseStatus {
  return licenseExpiry(activatedAt, now).getTime() > now.getTime()
    ? "active"
    : "expired";
}

/** Whole days left in the term; 0 once it has expired. */
export function licenseDaysRemaining(
  activatedAt?: string | null,
  now: Date = new Date(),
): number {
  const remaining =
    licenseExpiry(activatedAt, now).getTime() - startOfToday(now).getTime();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

/** Human-readable day, e.g. "28 September 2026". */
export function formatLicenseDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
