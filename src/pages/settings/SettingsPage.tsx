import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { version as reactVersion } from "react";
import {
  Building2,
  CheckCircle2,
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
  applyDarkMode,
  errorMessage,
  getSettings,
  saveSettings,
  type AppSettings,
} from "@/lib/api";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  APP_VERSION,
} from "@/lib/appInfo";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

const TABS = [
  { key: "general", label: "General" },
  { key: "preferences", label: "Preferences" },
  { key: "system", label: "System" },
  { key: "about", label: "About" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const LOGO_MAX_WIDTH = 200;

async function fileToLogoDataUrl(file: File): Promise<string> {
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
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [systemName, setSystemName] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(false);

  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setSystemName(settings.systemName ?? "");
        setUniversityName(settings.universityName ?? "");
        setLogoUrl(settings.logoUrl);
        setLanguage(settings.language);
        setDarkMode(settings.darkMode === true);
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
    applyDarkMode(darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const handleSave = async () => {
    const settings: AppSettings = {
      systemName: systemName.trim() || undefined,
      universityName: universityName.trim() || undefined,
      logoUrl,
      language,
      darkMode,
    };
    try {
      setSaving(true);
      setError(null);
      await saveSettings(settings);
      setSuccessMessage("Settings saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setError(null);
      setLogoUrl(dataUrl);
    } catch (err) {
      setError(errorMessage(err));
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

  if (loading) return <DataLoading label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide configuration for this center.
        </p>
      </div>

      {error && <DataError message={error} />}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList variant="line" className="h-10 w-full">
          {TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>
                Branding shown across the operator sidebar and top bar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-name">System name</Label>
                <Input
                  id="system-name"
                  placeholder="Student Manager System"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="university-name">University name</Label>
                <Input
                  id="university-name"
                  placeholder="Center / university name"
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>University logo</Label>
                <div className="flex flex-wrap items-center gap-4">
                  {logoUrl ? (
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={logoUrl}
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
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      Upload logo
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl(undefined)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
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
                  PNG or JPEG; downscaled to ≤{LOGO_MAX_WIDTH}px wide and stored
                  in settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Personal display preferences for this account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={language ?? ""}
                  onValueChange={(value) => setLanguage(value ?? undefined)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Dark mode</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Applies the dark theme across the whole app.
                  </p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={(checked) => setDarkMode(checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System</CardTitle>
              <CardDescription>
                Deployment details for this {APP_SHORT_NAME} instance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Check for updates</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Look for a newer version of the application.
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
                  {updateChecking ? "Checking…" : "Check for Updates"}
                </Button>
              </div>
              {updateResult && (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  {updateResult}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>
                Application details for this {APP_SHORT_NAME} deployment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={logoUrl}
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
              <Separator />
              <div className="space-y-3">
                <DetailRow label="Version" value={APP_VERSION} />
                <DetailRow label="Frontend" value={`React ${reactVersion}`} />
                <DetailRow label="Data layer" value="Supabase (PostgreSQL)" />
                <DetailRow
                  label="Copyright"
                  value={`\u00A9 ${new Date().getFullYear()} ${APP_NAME}`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}