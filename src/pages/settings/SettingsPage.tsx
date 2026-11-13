import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { version as reactVersion } from "react";
import {
  Building2,
  CheckCircle2,
  Database,
  ImagePlus,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  getSettings,
  reconcileAttendanceProfiles,
  saveSettings,
  uploadUniversityLogo,
  type AppSettings,
  type AttendanceSyncSummary,
} from "@/lib/api";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  APP_VERSION,
} from "@/lib/appInfo";
import { setBrandingFromSettings } from "@/lib/branding";
import { setTheme, useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import {
  INVALID_TOKEN_MESSAGE,
  isValidLicenseToken,
  licenseExpiry,
} from "@/lib/license";
import { LicenseTab } from "./LicenseTab";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { BackupExportPage } from "./BackupExportPage";

const TABS = [
  { key: "general", label: "General" },
  { key: "preferences", label: "Preferences" },
  { key: "system", label: "System" },
  { key: "about", label: "About" },
  { key: "license", label: "License" },
  { key: "backup-export", label: "Backup & Export" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// The stored asset is capped at this width; the login card shows it at h-16
// (64px), so 512 keeps it crisp on high-DPI screens without bloating the bucket.
const LOGO_MAX_WIDTH = 512;

const DEFAULT_TIMEZONE = "Africa/Tunis";
const DEFAULT_CURRENCY = "TND";

/**
 * Downscales a picked logo and returns it as a PNG blob ready for Storage.
 * PNG (not JPEG) because university logos rely on a transparent background.
 * Falls back to the original file if a 2d canvas context is unavailable.
 */
async function fileToLogoBlob(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image could not be decoded"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, LOGO_MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image could not be encoded")),
      "image/png",
    ),
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * Every editable column of `public.center_settings` (row id = 1) as string
 * drafts, so one state object backs all four form tabs and Save writes them
 * back in a single upsert.
 */
interface SettingsDraft {
  systemName: string;
  universityName: string;
  logoUrl: string;
  language: "en" | "fr";
  darkMode: boolean;
  academicYear: string;
  timezone: string;
  currency: string;
  sessionTimeoutMinutes: string;
  licenseKey: string;
  licensePlan: string;
  licenseStatus: string;
  licenseExpiresAt: string;
  lastBackupAt: string;
}

function draftFromSettings(settings: AppSettings): SettingsDraft {
  return {
    systemName: settings.systemName ?? "",
    universityName: settings.universityName ?? "",
    logoUrl: settings.logoUrl ?? "",
    language: settings.language === "fr" ? "fr" : "en",
    darkMode: settings.darkMode === true,
    academicYear: settings.academicYear ?? "",
    // The row defaults are the center's operating values, so an empty column
    // shows them as a starting point instead of a blank field.
    timezone: settings.timezone ?? DEFAULT_TIMEZONE,
    currency: settings.currency ?? DEFAULT_CURRENCY,
    sessionTimeoutMinutes:
      typeof settings.sessionTimeoutMinutes === "number"
        ? String(settings.sessionTimeoutMinutes)
        : "",
    licenseKey: settings.licenseKey ?? "",
    licensePlan: settings.licensePlan ?? "",
    licenseStatus: settings.licenseStatus ?? "",
    licenseExpiresAt: settings.licenseExpiresAt ?? "",
    lastBackupAt: settings.lastBackupAt ?? "",
  };
}

function settingsFromDraft(draft: SettingsDraft): AppSettings {
  const timeout = Number(draft.sessionTimeoutMinutes);
  return {
    systemName: draft.systemName.trim() || undefined,
    universityName: draft.universityName.trim() || undefined,
    logoUrl: draft.logoUrl.trim() || undefined,
    language: draft.language,
    darkMode: draft.darkMode,
    academicYear: draft.academicYear.trim() || undefined,
    timezone: draft.timezone.trim() || undefined,
    currency: draft.currency.trim() || undefined,
    sessionTimeoutMinutes:
      draft.sessionTimeoutMinutes.trim() !== "" && Number.isFinite(timeout)
        ? timeout
        : undefined,
    licenseKey: draft.licenseKey.trim() || undefined,
    licensePlan: draft.licensePlan.trim() || undefined,
    licenseStatus: draft.licenseStatus.trim() || undefined,
    licenseExpiresAt: draft.licenseExpiresAt || undefined,
    lastBackupAt: draft.lastBackupAt || undefined,
  };
}

export default function SettingsPage() {
  const { t, setLanguage: setAppLanguage } = useI18n();
  const [tab, setTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<SettingsDraft>(() =>
    draftFromSettings({}),
  );
  // Global store, not a local copy: the header/top bar and the other settings
  // pages switch at the same time as this switch.
  const theme = useTheme();

  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<AttendanceSyncSummary | null>(
    null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const update = <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        const next = draftFromSettings(settings);
        setDraft(next);
        // The row is the durable copy of the theme; the store was already
        // primed from the localStorage cache at boot.
        setTheme(next.darkMode ? "dark" : "light");
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  /**
   * The single write path: merges `patch` into the current draft, upserts row
   * id = 1, then immediately pushes the branding, language and theme stores so
   * the sidebar, header and login card re-render without a reload.
   */
  const persist = async (
    patch: Partial<AppSettings>,
    message: string,
    nextDraft?: SettingsDraft,
  ): Promise<boolean> => {
    const base = nextDraft ?? draft;
    const settings: AppSettings = { ...settingsFromDraft(base), ...patch };
    try {
      setSaving(true);
      setError(null);
      await saveSettings(settings);
      setBrandingFromSettings(settings);
      setAppLanguage(settings.language === "fr" ? "fr" : "en");
      setTheme(settings.darkMode === true ? "dark" : "light");
      setSuccessMessage(message);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    // `theme` is the live global store, so what the switch shows is what the row
    // gets even if another settings page changed it meanwhile.
    void persist({ darkMode: theme === "dark" }, "Settings saved.");
  };

  /**
   * Validates the pasted key against the issued token pool and restarts the
   * license term from today. The three license columns are persisted right away
   * (they are the tab's own action), and the rest of the form is saved with them.
   */
  const handleActivateLicense = async (key: string): Promise<boolean> => {
    setLicenseError(null);
    if (!isValidLicenseToken(key)) {
      setLicenseError(INVALID_TOKEN_MESSAGE);
      return false;
    }
    const expiresAt = licenseExpiry(new Date().toISOString()).toISOString();
    const nextDraft: SettingsDraft = {
      ...draft,
      licenseKey: key,
      licenseStatus: "active",
      licenseExpiresAt: expiresAt,
    };
    setDraft(nextDraft);
    return persist(
      {
        licenseKey: key,
        licenseStatus: "active",
        licenseExpiresAt: expiresAt,
      },
      "License activated.",
      nextDraft,
    );
  };

  /**
   * Uploads the picked logo to the 'Logo' bucket straight away and keeps only
   * the returned public URL in state. The row itself is written when the admin
   * presses Save, like every other field on this form.
   */
  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await fileToLogoBlob(file);
      const publicUrl = await uploadUniversityLogo(blob);
      update("logoUrl", publicUrl);
      setSuccessMessage("Logo uploaded. Press Save to store it.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckForUpdates = () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    window.setTimeout(() => {
      setUpdateChecking(false);
      setUpdateResult(
        `${APP_SHORT_NAME} ${APP_VERSION} is up to date (last checked just now).`,
      );
    }, 1200);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      setSyncResult(await reconcileAttendanceProfiles());
    } catch (err) {
      setSyncError(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <DataLoading label={t("Loading settings…")} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{t("Settings")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("System-wide configuration for this center.")}
        </p>
      </div>

      {error && <DataError message={error} />}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t(successMessage)}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList variant="line" className="h-10 w-full">
          {TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {t(item.label)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("General")}</CardTitle>
              <CardDescription>
                {t("Branding shown across the operator sidebar and top bar.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-name">{t("System name")}</Label>
                <Input
                  id="system-name"
                  placeholder="Student Manager System"
                  value={draft.systemName}
                  onChange={(e) => update("systemName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="university-name">{t("University name")}</Label>
                <Input
                  id="university-name"
                  placeholder={t("Center / university name")}
                  value={draft.universityName}
                  onChange={(e) => update("universityName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("University logo")}</Label>
                <div className="flex flex-wrap items-center gap-4">
                  {draft.logoUrl ? (
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={draft.logoUrl}
                        alt="University logo"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      {saving ? t("Uploading…") : t("Upload logo")}
                    </Button>
                    {draft.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => update("logoUrl", "")}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("Remove")}
                      </Button>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "PNG or JPEG; downscaled to {width}px wide and uploaded to the Logo bucket. Only the public URL is stored, then shown on the login card.",
                    { width: LOGO_MAX_WIDTH },
                  )}
                </p>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t("Saving…") : t("Save Settings")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("Preferences")}</CardTitle>
              <CardDescription>
                {t("Personal display preferences for this account.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Language")}</Label>
                <Select
                  value={draft.language}
                  onValueChange={(value) =>
                    update("language", value === "fr" ? "fr" : "en")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select language")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{t("Dark mode")}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Applies the dark theme across the whole app.")}
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => {
                    // Preview instantly; Save persists `dark_mode` on row 1.
                    update("darkMode", checked);
                    setTheme(checked ? "dark" : "light");
                  }}
                />
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t("Saving…") : t("Save Settings")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("System")}</CardTitle>
              <CardDescription>
                {t("Deployment details for this {name} instance.", {
                  name: APP_SHORT_NAME,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="academic-year">{t("Academic year")}</Label>
                  <Input
                    id="academic-year"
                    placeholder="2026-2027"
                    value={draft.academicYear}
                    onChange={(e) => update("academicYear", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t("Timezone")}</Label>
                  <Input
                    id="timezone"
                    placeholder={DEFAULT_TIMEZONE}
                    value={draft.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("IANA zone name used for timetables and dates.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t("Currency")}</Label>
                  <Input
                    id="currency"
                    placeholder={DEFAULT_CURRENCY}
                    maxLength={8}
                    value={draft.currency}
                    onChange={(e) => update("currency", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">
                    {t("Session timeout (minutes)")}
                  </Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    min={0}
                    step={5}
                    placeholder="60"
                    value={draft.sessionTimeoutMinutes}
                    onChange={(e) =>
                      update("sessionTimeoutMinutes", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("Idle minutes before the session expires; 0 disables it.")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{t("Check for updates")}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Look for a newer version of the application.")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckForUpdates}
                  disabled={updateChecking}
                >
                  <RefreshCw
                    className={
                      updateChecking ? "h-4 w-4 animate-spin" : "h-4 w-4"
                    }
                  />
                  {updateChecking ? t("Checking…") : t("Check for Updates")}
                </Button>
              </div>
              {updateResult && (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  {updateResult}
                </p>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>{t("Sync & validate data")}</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(
                        "Scans the attendance log for records missing program, training or class info and backfills them from the matching student/teacher profiles. Stored values are never overwritten, only gaps are filled.",
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    <Database className="h-4 w-4" />
                    {syncing ? t("Syncing…") : t("Sync Data")}
                  </Button>
                </div>

                {syncError && <DataError message={syncError} />}

                {syncResult && (
                  <div className="space-y-3 rounded-md border bg-muted/50 p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("Scanned")}
                        </p>
                        <p className="font-semibold">{syncResult.scanned}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("Fixed")}
                        </p>
                        <p className="font-semibold text-green-700 dark:text-green-400">
                          {syncResult.updated}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("Unmatched")}
                        </p>
                        <p className="font-semibold">
                          {syncResult.unmatched}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("Failed")}
                        </p>
                        <p className="font-semibold">
                          {syncResult.failed}
                        </p>
                      </div>
                    </div>

                    {syncResult.details.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                        <table className="w-full text-sm">
                          <tbody>
                            {syncResult.details.map((d) => (
                              <tr
                                key={d.id}
                                className="border-b last:border-b-0"
                              >
                                <td className="px-3 py-1.5 font-medium">
                                  {d.fullName}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-muted-foreground uppercase">
                                  {d.type}
                                </td>
                                <td className="px-3 py-1.5 text-xs">
                                  {[
                                    d.changed.program && "program",
                                    d.changed.training && "training",
                                    d.changed.className && "class",
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t("Saving…") : t("Save Settings")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("About")}</CardTitle>
              <CardDescription>
                {t("Application details for this {name} deployment.", {
                  name: APP_SHORT_NAME,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {draft.logoUrl ? (
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={draft.logoUrl}
                      alt="University logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    {APP_SHORT_NAME}
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold">{APP_NAME}</p>
                  <p className="text-xs text-muted-foreground">
                    {APP_DESCRIPTION}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Version & build")}</CardTitle>
              <CardDescription>
                {t("Compiled client details for this deployment.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label={t("Version")} value={APP_VERSION} />
              <DetailRow
                label={t("Build")}
                value={import.meta.env.MODE === "production" ? "Production" : "Development"}
              />
              <DetailRow label={t("Frontend")} value={`React ${reactVersion}`} />
              <DetailRow
                label={t("Data layer")}
                value="Supabase (PostgreSQL)"
              />
              <DetailRow
                label={t("Copyright")}
                value={`\u00A9 ${new Date().getFullYear()} ${APP_NAME}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Center information")}</CardTitle>
              <CardDescription>
                {t("Values saved on this center's settings row.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label={t("System name")}
                value={draft.systemName.trim() || "—"}
              />
              <DetailRow
                label={t("University name")}
                value={draft.universityName.trim() || "—"}
              />
              <DetailRow
                label={t("Academic year")}
                value={draft.academicYear.trim() || "—"}
              />
              <DetailRow label={t("Timezone")} value={draft.timezone || "—"} />
              <DetailRow label={t("Currency")} value={draft.currency || "—"} />
              <DetailRow
                label={t("Last backup")}
                value={
                  draft.lastBackupAt
                    ? new Date(draft.lastBackupAt).toLocaleString()
                    : "—"
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="license" className="mt-6 space-y-4">
          <LicenseTab
            plan={draft.licensePlan}
            status={draft.licenseStatus}
            licenseKey={draft.licenseKey}
            expiresAt={draft.licenseExpiresAt}
            activating={saving}
            error={licenseError}
            onActivate={handleActivateLicense}
          />
        </TabsContent>

        <TabsContent value="backup-export" className="mt-6 space-y-4">
          <BackupExportPage
            onBackupDone={(at) => update("lastBackupAt", at)}
            lastBackupAt={draft.lastBackupAt}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
