import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataLoading } from "@/components/DataState";
import UserAvatar from "@/components/UserAvatar";
import {
  applyDarkMode,
  errorMessage,
  getSettings,
  saveSettings,
  updateAccount,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import { hasAccount } from "@/pages/users/userAccounts";
import { loadCurrentStudent } from "./currentStudent";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function StudentSettingsPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled) return;
        setStudent(record);
        if (!record) return;
        try {
          const settings = await getSettings();
          if (cancelled) return;
          setDarkMode(settings.darkMode === true);
        } catch {
          // The settings table may be missing — the toggle still works
          // for the current session via the local cache fallback.
        }
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (student !== undefined) applyDarkMode(darkMode);
  }, [darkMode, student]);

  useEffect(() => {
    if (!passwordMessage) return;
    const timeout = window.setTimeout(() => setPasswordMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [passwordMessage]);

  const handleToggleDarkMode = async (checked: boolean) => {
    setDarkMode(checked);
    try {
      const settings = await getSettings();
      await saveSettings({ ...settings, darkMode: checked });
    } catch {
      // Best effort — applyDarkMode already toggled the current view.
    }
  };

  const handleSavePassword = async () => {
    if (!student) return;
    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (currentPassword !== (student.password ?? "")) {
      setPasswordError("The current password is incorrect.");
      return;
    }
    setPasswordError(null);
    setSavingPassword(true);
    try {
      await updateAccount("students", student.id, {
        password: newPassword.trim(),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  if (student === undefined) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <DataLoading label="Loading settings…" />
      </div>
    );
  }

  if (!student) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Settings</h2>

      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserAvatar name={student.fullName} fallback="S" className="h-10 w-10" />
            <div>
              <CardTitle>{student.fullName}</CardTitle>
              <CardDescription>Student account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator />
          <InfoRow label="Program" value={student.program} />
          <Separator />
          <InfoRow label="Training" value={student.training || "—"} />
          <Separator />
          <InfoRow label="Phone Number" value={student.phone || "—"} />
          <Separator />
          <InfoRow label="Email" value={student.email || "—"} />
          <Separator />
          <InfoRow label="Location" value={student.location || "—"} />
          <Separator />
          <InfoRow label="Education" value={student.education || "—"} />
          <Separator />
          <InfoRow label="Age" value={student.age ? String(student.age) : "—"} />
          <Separator />
          <InfoRow label="Engagement" value={student.engagement || "—"} />
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <CardTitle>Login Account</CardTitle>
          <CardDescription>
            Set a new password for logging into the student portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasAccount(student) ? (
            <div className="space-y-4">
              {passwordError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              )}
              {passwordMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {passwordMessage}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat the new password"
                />
              </div>
              <Button onClick={handleSavePassword} disabled={savingPassword}>
                {savingPassword ? "Saving…" : "Update Password"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have no login account yet. Ask the center to create one for
              you.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Applies the dark theme across the whole app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm font-medium">Dark mode</span>
          <Switch checked={darkMode} onCheckedChange={handleToggleDarkMode} />
        </CardContent>
      </Card>
    </div>
  );
}