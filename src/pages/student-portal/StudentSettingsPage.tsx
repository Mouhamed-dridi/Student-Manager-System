import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataLoading } from "@/components/DataState";
import UserAvatar from "@/components/UserAvatar";
import {
  applyDarkMode,
  errorMessage,
  getSettings,
  saveSettings,
  updateStudentProfile,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

const ENGAGEMENT_OPTIONS = ["New Student", "Second Year"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function EditableRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="w-44 shrink-0">{children}</div>
    </div>
  );
}

function ProfileEditor({ student }: { student: Student }) {
  const [location, setLocation] = useState(student.location ?? "");
  const [age, setAge] = useState(student.age ? String(student.age) : "");
  const [engagement, setEngagement] = useState(student.engagement ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = window.setTimeout(() => setSaveMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const handleSaveProfile = async () => {
    const parsedAge = age.trim() === "" ? undefined : Math.round(Number(age));
    if (age.trim() !== "" && !Number.isFinite(parsedAge)) {
      setSaveError("Age must be a number.");
      return;
    }
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      await updateStudentProfile(student.id, {
        fullName: student.fullName,
        program: student.program,
        training: student.training,
        phone: student.phone,
        email: student.email,
        location: location.trim() || undefined,
        education: student.education,
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        engagement: engagement.trim() || undefined,
      });
      setSaveMessage("Changes saved.");
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
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
        <InfoRow label="Education" value={student.education || "—"} />

        <Separator />
        <EditableRow label="Location" htmlFor="student-location">
          <Input
            id="student-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Your location"
          />
        </EditableRow>
        <Separator />
        <EditableRow label="Age" htmlFor="student-age">
          <Input
            id="student-age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Your age"
            min={0}
          />
        </EditableRow>
        <Separator />
        <EditableRow label="Engagement">
          <Select
            value={engagement}
            onValueChange={(value) => setEngagement(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select engagement" />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditableRow>

        <Separator />
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          {saveMessage && (
            <p className="text-sm text-green-600 dark:text-green-400">
              {saveMessage}
            </p>
          )}
          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentSettingsPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(false);

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

  const handleToggleDarkMode = async (checked: boolean) => {
    setDarkMode(checked);
    try {
      const settings = await getSettings();
      await saveSettings({ ...settings, darkMode: checked });
    } catch {
      // Best effort — applyDarkMode already toggled the current view.
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

      <ProfileEditor key={student.id} student={student} />

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