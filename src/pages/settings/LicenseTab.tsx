import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Mail,
  Phone,
  RefreshCw,
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
import { APP_NAME, APP_SHORT_NAME } from "@/lib/appInfo";
import {
  DEFAULT_LICENSE_TOKEN,
  LICENSE_TERM_MONTHS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  formatLicenseDate,
  licenseDaysRemaining,
  licenseExpiry,
  licenseStatus,
  licenseTermStart,
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface LicenseTabProps {
  activatedAt?: string;
  /** The token currently activated; falls back to the default pool entry. */
  token?: string;
  saving: boolean;
  renewing: boolean;
  onSave: () => void;
  /** Opens the license-token dialog owned by the settings page. */
  onRenew: () => void;
}

export function LicenseTab({
  activatedAt,
  token,
  saving,
  renewing,
  onSave,
  onRenew,
}: LicenseTabProps) {
  const activeToken = token ?? DEFAULT_LICENSE_TOKEN;
  const isActive = licenseStatus(activatedAt) === "active";
  const daysRemaining = licenseDaysRemaining(activatedAt);
  const [copied, setCopied] = useState(false);

  // The token is also shown as text, so a blocked clipboard (insecure origin or
  // a denied permission) is not fatal — the operator can select it manually.
  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(activeToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const remainingLabel = !isActive
    ? "Renew to continue"
    : daysRemaining === 1
      ? "1 day remaining"
      : `${daysRemaining} days remaining`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>License</CardTitle>
        <CardDescription>
          Subscription status for this {APP_SHORT_NAME} deployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">SaaS Status</p>
            <span
              className={
                isActive
                  ? "mt-1 inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-sm font-medium text-green-700 dark:text-green-400"
                  : "mt-1 inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-sm font-medium text-destructive"
              }
            >
              {isActive ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {isActive ? "Active" : "Expired"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {APP_NAME} · {LICENSE_TERM_MONTHS}-month term
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <InfoRow
            label="Term started"
            value={formatLicenseDate(licenseTermStart(activatedAt))}
          />
          <InfoRow
            label="Expiration date"
            value={formatLicenseDate(licenseExpiry(activatedAt))}
          />
          <InfoRow label="Remaining" value={remainingLabel} />

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="active-license-token">License Token</Label>
            <div className="flex items-center gap-2">
              <Input
                id="active-license-token"
                readOnly
                value={activeToken}
                className="font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyToken}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The key currently activated on this deployment. Quote it when
              contacting {APP_SHORT_NAME} support.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Support Channels</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Reach the {APP_SHORT_NAME} team for billing, renewal or
              installation questions.
            </p>
          </div>
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
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="mr-auto text-xs text-muted-foreground">
            Renewing restarts the {LICENSE_TERM_MONTHS}-month term from today.
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving || renewing}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save Settings"}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={renewing}
            onClick={onRenew}
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/50 dark:hover:bg-green-500"
          >
            <RefreshCw
              className={renewing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            {renewing ? "Renewing…" : "Renew License"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
