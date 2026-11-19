import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { APP_SHORT_NAME } from "@/lib/appInfo";
import { useI18n } from "@/lib/i18n";
import {
  LICENSE_PLANS,
  LICENSE_KEY_PLACEHOLDER,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  formatLicenseDate,
  licenseDaysRemaining,
  licensePlanDays,
  maskLicenseKey,
} from "@/lib/license";

interface SupportChannel {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
}

const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    label: "Mail Support",
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    icon: Mail,
  },
  {
    label: "Telephone Support",
    value: SUPPORT_PHONE,
    // tel: takes digits and a leading + only; drop spaces, dashes and brackets.
    href: `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`,
    icon: Phone,
  },
];

/** Re-renders once a minute so the remaining-days counter stays honest. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface LicenseTabProps {
  plan: string;
  status: string;
  licenseKey: string;
  /** ISO timestamp of `license_expires_at`. */
  expiresAt: string;
  /** True while an activation is in flight. */
  activating: boolean;
  /** Rejected-key message shown above the activation action. */
  error: string | null;
  /** Resolves true once the key was saved, so the input can clear itself. */
  onActivate: (key: string) => Promise<boolean>;
}

/**
 * License columns of `center_settings` row id = 1 (read-only) plus the one
 * write this tab owns: activating a key. The three term cards double as a
 * picker for the prefix expected in the input.
 */
export function LicenseTab({
  plan,
  status,
  licenseKey,
  expiresAt,
  activating,
  error,
  onActivate,
}: LicenseTabProps) {
  const { t } = useI18n();
  const [newKey, setNewKey] = useState("");
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const now = useMinuteTick();

  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const validExpiry =
    expiresDate && !Number.isNaN(expiresDate.getTime()) ? expiresDate : null;
  const daysRemaining = licenseDaysRemaining(expiresAt, now);
  const isActive = daysRemaining > 0;
  const storedStatus = status.trim().toLowerCase();
  const statusLabel = isActive
    ? "Active"
    : validExpiry || storedStatus === "expired"
      ? "Expired"
      : "Inactive";

  const planDays = licensePlanDays(plan);
  const progress =
    planDays > 0 ? Math.min(100, Math.round((daysRemaining / planDays) * 100)) : 0;

  const submitKey = async () => {
    const key = newKey.trim();
    if (!key || activating) return;
    if (await onActivate(key)) {
      setNewKey("");
      setSelectedPrefix(null);
    }
  };

  const pickPrefix = (prefix: string) => {
    setSelectedPrefix(prefix);
    inputRef.current?.focus();
  };

  const placeholder = selectedPrefix
    ? `${selectedPrefix}-${LICENSE_KEY_PLACEHOLDER.slice(2)}`
    : LICENSE_KEY_PLACEHOLDER;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t("License")}
          </CardTitle>
          <CardDescription>
            Subscription status for this {APP_SHORT_NAME} deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Active plan")}
                </p>
                <p className="text-lg font-semibold">
                  {plan.trim() || t("No plan")}
                </p>
              </div>
              <StatusPill active={isActive} label={statusLabel} />
            </div>

            <Separator className="my-4" />

            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Days remaining")}
                </p>
                <p className="text-3xl font-semibold tabular-nums leading-none">
                  {daysRemaining}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Expires")}
                </p>
                <p className="text-sm font-medium">
                  {validExpiry ? formatLicenseDate(validExpiry) : t("Not activated")}
                </p>
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] duration-500 dark:bg-zinc-100"
                style={{ width: `${progress}%` }}
              />
            </div>

            <Separator className="my-4" />

            <InfoRow label={t("License key")} value={maskLicenseKey(licenseKey)} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{t("License terms")}</p>
              <p className="text-xs text-muted-foreground">
                {t("Each key adds its term to the activation date.")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {LICENSE_PLANS.map((option) => {
                const selected = selectedPrefix === option.prefix;
                const current =
                  plan.trim().toLowerCase() === option.label.toLowerCase();
                return (
                  <button
                    key={option.prefix}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => pickPrefix(option.prefix)}
                    className={`relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600"
                    }`}
                  >
                    {current && (
                      <span className="absolute right-3 top-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("Current")}
                      </span>
                    )}
                    <span className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                      {option.prefix}-
                    </span>
                    <span className="text-lg font-semibold leading-tight">
                      {t(option.label)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("{days} days", { days: option.days })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-license-key">{t("Activate a new key")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="new-license-key"
                ref={inputRef}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                placeholder={placeholder}
                className="min-w-0 flex-1 font-mono uppercase"
                spellCheck={false}
                autoComplete="off"
                disabled={activating}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void submitKey();
                }}
              />
              <Button
                type="button"
                disabled={activating || newKey.trim() === ""}
                onClick={() => void submitKey()}
              >
                <KeyRound className="h-4 w-4" />
                {activating ? t("Activating…") : t("Activate License")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "Keys look like M-XXXX-XXXX-XXXX-XXXX-XXXX (four or five groups). Activating restarts the term from today and updates the plan, status and expiration date on this center.",
              )}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support Channels</CardTitle>
          <CardDescription>
            Reach the {APP_SHORT_NAME} team for billing, renewal or installation
            questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUPPORT_CHANNELS.map((channel) => (
              <a
                key={channel.label}
                href={channel.href}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background">
                  <channel.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {channel.label}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {channel.value}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
