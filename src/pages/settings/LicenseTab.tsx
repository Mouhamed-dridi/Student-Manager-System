import { useState } from "react";
import { CheckCircle2, KeyRound, Mail, Phone, ShieldCheck, XCircle } from "lucide-react";
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
import {
  LICENSE_TERM_MONTHS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  formatLicenseDate,
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

/** Trims a key down to its ends so a full token is never shown on screen. */
function maskLicenseKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}••••••`;
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
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
  /** True while a save/activation is in flight. */
  activating: boolean;
  /** Rejected-key message shown above the activation action. */
  error: string | null;
  /** Resolves true once the key was saved, so the input can clear itself. */
  onActivate: (key: string) => Promise<boolean>;
}

/**
 * Read-only view of the license columns on `center_settings` row id = 1, plus
 * the one write this tab owns: activating a new key (which also restarts the
 * term and is saved by the parent page).
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
  const [newKey, setNewKey] = useState("");
  // Captured once so the status computation below stays pure during render.
  const [now] = useState(() => Date.now());

  const submitKey = async () => {
    const key = newKey.trim();
    if (!key || activating) return;
    if (await onActivate(key)) setNewKey("");
  };

  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const validExpiry =
    expiresDate && !Number.isNaN(expiresDate.getTime()) ? expiresDate : null;
  const storedStatus = status.trim().toLowerCase();
  const effectiveStatus =
    storedStatus ||
    (validExpiry
      ? validExpiry.getTime() > now
        ? "active"
        : "expired"
      : "inactive");
  const isActive = effectiveStatus === "active";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            License
          </CardTitle>
          <CardDescription>
            Subscription status for this {APP_SHORT_NAME} deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Plan
                </p>
                <p className="text-lg font-semibold">
                  {plan.trim() || "Standard"}
                </p>
              </div>
              <StatusPill
                active={isActive}
                label={
                  isActive
                    ? "Active"
                    : effectiveStatus === "expired"
                      ? "Expired"
                      : "Inactive"
                }
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <InfoRow
                label="License key"
                value={maskLicenseKey(licenseKey)}
              />
              <InfoRow
                label="Expiration date"
                value={
                  validExpiry ? formatLicenseDate(validExpiry) : "Not activated"
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-license-key">Activate a new key</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="new-license-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Paste your license key here…"
                className="min-w-0 flex-1 font-mono"
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
                {activating ? "Activating…" : "Activate"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Activating restarts the {LICENSE_TERM_MONTHS}-month term from today
              and updates the plan, status and expiration date on this center.
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
