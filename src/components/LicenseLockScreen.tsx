import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { useI18n } from "@/lib/i18n";
import {
  LICENSE_PLANS,
  LICENSE_KEY_PLACEHOLDER,
  SUPPORT_EMAIL,
  formatLicenseDate,
} from "@/lib/license";
import { activateLicenseKey } from "@/lib/licenseStore";

type LockScreenMode = "checking" | "locked";

interface LicenseLockScreenProps {
  /** "checking" while the first `center_settings` read is in flight. */
  mode: LockScreenMode;
  /** ISO timestamp of the stored expiration, when there is one. */
  expiresAt?: string;
  /** A read failure to explain (offline, missing table, …). */
  readError?: string | null;
}

/** Shared field/button styling: zinc only, so it reads in both themes. */
const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm uppercase tracking-[0.12em] text-zinc-100 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-500/30 disabled:cursor-not-allowed disabled:opacity-60";

const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Full-screen gate rendered instead of the app's routes whenever
 * `center_settings.license_expires_at` is missing or in the past.
 *
 * It is deliberately theme-independent (always dark zinc) so an expired license
 * looks the same for every role, and it carries its own activation form: a valid
 * key is written to `center_settings` row id = 1 and the shared license store
 * unlocks the workspace immediately, without a reload.
 */
export function LicenseLockScreen({
  mode,
  expiresAt,
  readError,
}: LicenseLockScreenProps) {
  const { t } = useI18n();
  const { systemName, universityName, logoUrl } = useBranding();
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checking = mode === "checking";

  const expiry = expiresAt ? new Date(expiresAt) : null;
  const validExpiry =
    expiry && !Number.isNaN(expiry.getTime()) ? expiry : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = key.trim();
    if (!value || activating) return;

    setActivating(true);
    setError(null);
    const result = await activateLicenseKey(value);
    setActivating(false);
    if (!result.ok) {
      setError(result.error ?? t("That license key is not valid."));
      return;
    }
    // The store already published the new expiry, so the gate re-renders the
    // workspace on the next paint. Nothing else to do here.
    setKey("");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 text-zinc-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(255,255,255,0.10), transparent 65%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          {logoUrl && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
          )}
          <span className="text-left">
            <span className="block text-sm font-semibold tracking-tight text-white">
              {systemName}
            </span>
            {universityName && (
              <span className="block text-xs text-zinc-500">
                {universityName}
              </span>
            )}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950">
              {checking ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
              ) : (
                <LockKeyhole className="h-5 w-5 text-zinc-300" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                {checking ? t("License verification") : t("License required")}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {checking ? t("Checking your license…") : t("License expired")}
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {checking
              ? t(
                  "The workspace stays locked until a valid license is confirmed.",
                )
              : validExpiry
                ? t(
                    "The license for this center expired on {date}. Enter a valid key to restore access.",
                    { date: formatLicenseDate(validExpiry) },
                  )
                : t(
                    "No valid license is active on this center. Enter a valid key to unlock the workspace.",
                  )}
          </p>

          {!checking && readError && (
            <p className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              {readError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label
              htmlFor="lock-license-key"
              className="block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500"
            >
              {t("License key")}
            </label>
            <input
              id="lock-license-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder={LICENSE_KEY_PLACEHOLDER}
              className={FIELD_CLASS}
              spellCheck={false}
              autoComplete="off"
              autoFocus
              disabled={activating}
            />

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className={PRIMARY_BUTTON_CLASS}
              disabled={activating || key.trim() === ""}
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {activating ? t("Activating…") : t("Activate Product")}
              {!activating && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">
              {t("Accepted key formats")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LICENSE_PLANS.map((plan) => (
                <div
                  key={plan.prefix}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-center"
                >
                  <p className="font-mono text-sm font-semibold text-zinc-200">
                    {plan.prefix}-
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {t(plan.label)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-600">
          <Mail className="h-3.5 w-3.5" />
          {t("Need help? Contact support at {email}.", { email: SUPPORT_EMAIL })}
        </p>
      </div>
    </div>
  );
}
