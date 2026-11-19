// License keys, terms and expiry maths behind the Settings > License tab and
// the app-wide lock screen.
//
// A key is `PREFIX-XXXX-XXXX-XXXX-XXXX[-XXXX]` (case-insensitive): four or five
// groups of four characters, where every X is a letter or digit and the prefix
// picks the term:
//
//   M-  →  1 Month   (+30 days from activation)
//   3-  →  3 Months  (+90 days from activation)
//   Y-  →  1 Year    (+365 days from activation)
//
// There is no licensing backend. Activating a key stores the key, plan label,
// status and an absolute `license_expires_at` timestamp on
// `center_settings` row id = 1 (see `saveLicenseActivation` in lib/api.ts);
// everything else — the remaining-days counter and the lock screen — is derived
// from that timestamp.

export const LICENSE_KEY_PLACEHOLDER = "M-XXXX-XXXX-XXXX-XXXX-XXXX";

export const LICENSE_PREFIXES = ["M", "3", "Y"] as const;

export type LicensePrefix = (typeof LICENSE_PREFIXES)[number];

export interface LicensePlan {
  /** First segment of the key. */
  prefix: LicensePrefix;
  /** Stored in `center_settings.license_plan` and shown as the active plan. */
  label: string;
  /** Days added to the activation date. */
  days: number;
}

/** Card order and copy for the three terms offered in Settings > License. */
export const LICENSE_PLANS: readonly LicensePlan[] = [
  { prefix: "M", label: "1 Month", days: 30 },
  { prefix: "3", label: "3 Months", days: 90 },
  { prefix: "Y", label: "1 Year", days: 365 },
] as const;

/** Copy shown whenever a submitted key fails the format/prefix check. */
export const INVALID_LICENSE_KEY_MESSAGE =
  "Invalid license key. Use M- (1 month), 3- (3 months) or Y- (1 year) followed by four or five groups of four characters, e.g. M-XXXX-XXXX-XXXX-XXXX-XXXX.";

/** Stored in `center_settings.license_status` while the key is in force. */
export const LICENSE_STATUS_ACTIVE = "Active";

// Four or five groups of four alphanumerics after the prefix. Input is
// upper-cased by normalizeLicenseKey() first, so the `i` flag is belt-and-braces
// for direct callers of this pattern.
const LICENSE_KEY_PATTERN = /^(M|3|Y)(-[A-Z0-9]{4}){4,5}$/i;

/** Support contacts shown on the License tab and the lock screen. */
export const SUPPORT_EMAIL = "support@example.com";
export const SUPPORT_PHONE = "+00 00 00 00 00";

export interface ParsedLicenseKey {
  /** Normalized (trimmed, upper-cased) key, safe to store as-is. */
  key: string;
  prefix: LicensePrefix;
  plan: LicensePlan;
}

/** Trims and upper-cases, so typing the key in any case is accepted. */
export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase();
}

export function planForPrefix(prefix: string): LicensePlan | null {
  const normalized = prefix.trim().toUpperCase();
  return LICENSE_PLANS.find((plan) => plan.prefix === normalized) ?? null;
}

/**
 * Parses a key, or returns null when the shape or the prefix is wrong. The
 * normalized key is returned so callers store one canonical spelling.
 */
export function parseLicenseKey(key: string): ParsedLicenseKey | null {
  const normalized = normalizeLicenseKey(key);
  if (!LICENSE_KEY_PATTERN.test(normalized)) return null;
  const plan = planForPrefix(normalized.slice(0, 1));
  if (!plan) return null;
  return { key: normalized, prefix: plan.prefix, plan };
}

export function isValidLicenseKey(key: string): boolean {
  return parseLicenseKey(key) !== null;
}

/**
 * Activation date plus the prefix's term. Null when the key itself is invalid,
 * so callers can reject before touching the database.
 */
export function licenseExpiryForKey(
  key: string,
  now: Date = new Date(),
): Date | null {
  const parsed = parseLicenseKey(key);
  if (!parsed) return null;
  return new Date(now.getTime() + parsed.plan.days * 86_400_000);
}

/**
 * Whole days left before `expiresAt`; 0 once it has passed, or when the column
 * is missing/unreadable. Deliberately not clamped to a plan term: a key stored
 * with a long expiry keeps counting down from the real timestamp.
 */
export function licenseDaysRemaining(
  expiresAt?: string | null,
  now: number = Date.now(),
): number {
  if (!expiresAt) return 0;
  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) return 0;
  return Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));
}

/** True when there is no usable expiration date, or it is already behind us. */
export function isLicenseLocked(
  expiresAt?: string | null,
  now: number = Date.now(),
): boolean {
  return licenseDaysRemaining(expiresAt, now) <= 0;
}

/** The stored plan label, or a readable fallback for older rows. */
export function licensePlanLabel(plan?: string | null): string {
  const stored = plan?.trim();
  if (!stored) return "No plan";
  const known = LICENSE_PLANS.find(
    (candidate) => candidate.label.toLowerCase() === stored.toLowerCase(),
  );
  return known?.label ?? stored;
}

/** The term in days for a stored plan label, used by the progress bar. */
export function licensePlanDays(plan?: string | null): number {
  const stored = plan?.trim().toLowerCase();
  return (
    LICENSE_PLANS.find(
      (candidate) =>
        candidate.label.toLowerCase() === stored ||
        candidate.prefix.toLowerCase() === stored,
    )?.days ?? 0
  );
}

/**
 * Keeps the prefix, the first group and the last group, masking everything
 * between: `M-A1B2-C3D4-E5F6-G7H8` → `M-A1B2-••••-••••-G7H8`, and the 5-group
 * form → `M-A1B2-••••-••••-••••-H9J0`.
 */
export function maskLicenseKey(key: string): string {
  const normalized = normalizeLicenseKey(key);
  if (!normalized) return "—";
  const parts = normalized.split("-");
  if (parts.length < 4) {
    return `${normalized.slice(0, 4)}••••••${normalized.slice(-4)}`;
  }
  const masked = parts.slice(2, -1).map(() => "••••");
  return [parts[0], parts[1], ...masked, parts[parts.length - 1]].join("-");
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
