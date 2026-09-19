import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  getSettings,
  saveSettings,
  type AppNotifications,
  type AppSettings,
} from "@/lib/api";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

const NOTIFICATION_LABELS: { key: keyof AppNotifications; label: string }[] = [
  { key: "email", label: "Email notifications" },
  { key: "sms", label: "SMS notifications" },
  { key: "inApp", label: "In-app notifications" },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [systemName, setSystemName] = useState("");
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [notifications, setNotifications] = useState<AppNotifications>({
    email: false,
    sms: false,
    inApp: false,
  });
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setSystemName(settings.systemName ?? "");
        setLanguage(settings.language);
        setNotifications(settings.notifications ?? {
          email: false,
          sms: false,
          inApp: false,
        });
        setAdminName(settings.adminName ?? "");
        setAdminEmail(settings.adminEmail ?? "");
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

  const handleSave = async () => {
    const settings: AppSettings = {
      systemName: systemName.trim() || undefined,
      language,
      notifications,
      adminName: adminName.trim() || undefined,
      adminEmail: adminEmail.trim() || undefined,
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

  if (loading) return <DataLoading label="Loading settings…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide SaaS configuration for this center.
        </p>
      </div>

      {error && <DataError message={error} />}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            System name is shown in the sidebar and top bar.
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Language preference is stored with this account.
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

          <div className="space-y-3">
            <Label>Notification preferences</Label>
            {NOTIFICATION_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm">{label}</span>
                <Switch
                  checked={notifications[key]}
                  onCheckedChange={(checked) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [key]: checked,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin profile</CardTitle>
          <CardDescription>
            Contact details for the operator account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-name">Display name</Label>
            <Input
              id="admin-name"
              placeholder="Administrator"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}