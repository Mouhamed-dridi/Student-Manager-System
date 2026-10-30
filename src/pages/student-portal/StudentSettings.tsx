import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebook,
  faGithub,
  faInstagram,
  faLinkedin,
  faWhatsapp,
} from "@fortawesome/free-brands-svg-icons";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataLoading } from "@/components/DataState";
import UserAvatar from "@/components/UserAvatar";
import {
  applyDarkMode,
  deleteProfilePicture,
  errorMessage,
  getSettings,
  saveSettings,
  updateStudentProfile,
  uploadProfilePicture,
} from "@/lib/api";
import type { UserProfile } from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { notifyStudentProfileChanged } from "@/lib/studentProfile";
import {
  loadUserProfile,
  saveUserProfile,
  useUserProfile,
  userProfileFullName,
} from "@/lib/userProfile";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

const ENGAGEMENT_OPTIONS = ["New Student", "Second Year"];

/**
 * "Ada Lovelace" -> { first: "Ada", last: "Lovelace" }; extra words stay in the
 * last name. Mirrors the teacher settings page so both portals behave alike.
 */
function splitFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// Every social platform the students table can store, with the official brand
// mark shown as the input's leading adornment.
const SOCIAL_FIELDS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: faLinkedin,
    placeholder: "linkedin.com/in/username",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: faWhatsapp,
    placeholder: "wa.me/15551234567",
  },
  {
    key: "github",
    label: "GitHub",
    icon: faGithub,
    placeholder: "github.com/username",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: faFacebook,
    placeholder: "facebook.com/username",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: faInstagram,
    placeholder: "instagram.com/username",
  },
] as const;

type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];
type SocialState = Record<SocialKey, string>;

export default function StudentSettingsPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  // The form waits for the user_profiles row so its inputs start from the
  // database values instead of the students-table fallback.
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled) return;
        setStudent(record);
        if (!record) return;
        await loadUserProfile("student", record.id).catch(() => null);
        if (!cancelled) setProfileReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setStudent(null);
          setProfileReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (student === undefined || (student && !profileReady)) {
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
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your profile and display preferences.
      </p>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab key={student.id} student={student} onSaved={setStudent} />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <GeneralTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab({
  student,
  onSaved,
}: {
  student: Student;
  onSaved: (next: Student) => void;
}) {
  // user_profiles is the source for the name/photo in the top bar; the
  // students row is the fallback for accounts created before that table.
  const profile = useUserProfile("student", student.id);
  const initial = splitFullName(userProfileFullName(profile) || student.fullName);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [location, setLocation] = useState(student.location ?? "");
  const [age, setAge] = useState(student.age ? String(student.age) : "");
  const [engagement, setEngagement] = useState(student.engagement ?? "");
  const [social, setSocial] = useState<SocialState>({
    linkedin: profile?.linkedinUrl ?? student.linkedin ?? "",
    whatsapp: profile?.whatsappNumber ?? student.whatsapp ?? "",
    github: profile?.githubUrl ?? student.github ?? "",
    facebook: student.facebook ?? "",
    instagram: student.instagram ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const avatar = profile?.avatarUrl;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  /**
   * The whole row to write. The upsert replaces it, so every partial save
   * (photo, links) folds in the current form values instead of blanking the
   * columns it does not touch.
   */
  const profileBase = (): UserProfile => ({
    userId: student.id,
    role: "student",
    firstName: firstName.trim() || profile?.firstName || initial.first,
    lastName: lastName.trim() || profile?.lastName || initial.last,
    avatarUrl: avatar ?? undefined,
    linkedinUrl: profile?.linkedinUrl ?? (student.linkedin || undefined),
    whatsappNumber: profile?.whatsappNumber ?? (student.whatsapp || undefined),
    githubUrl: profile?.githubUrl ?? (student.github || undefined),
  });

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = window.setTimeout(() => setSaveMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const previewName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || student.fullName;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file again still fires change.
    event.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    let uploaded: string | undefined;
    try {
      // Storage first: the row only ever points at an object that exists.
      uploaded = await uploadProfilePicture(student.id, file);
      const previous = avatar;
      await saveUserProfile({ ...profileBase(), avatarUrl: uploaded });
      if (previous && previous !== uploaded) {
        void deleteProfilePicture(previous).catch(() => {});
      }
    } catch (err) {
      // Do not leave an unreferenced object behind when the row write fails.
      if (uploaded) void deleteProfilePicture(uploaded).catch(() => {});
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleUseUrl = async () => {
    const value = urlDraft.trim();
    if (!value) {
      setAvatarError("Paste an image URL first.");
      return;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
    } catch {
      setAvatarError("Enter a valid http(s) image URL.");
      return;
    }
    setAvatarError(null);
    setAvatarBusy(true);
    const previous = avatar;
    try {
      await saveUserProfile({ ...profileBase(), avatarUrl: value });
      setUrlDraft("");
      // No-op for a pasted URL; frees the previous upload when there was one.
      void deleteProfilePicture(previous).catch(() => {});
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarBusy(true);
    const previous = avatar;
    try {
      await saveUserProfile({ ...profileBase(), avatarUrl: undefined });
      if (previous) void deleteProfilePicture(previous).catch(() => {});
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      setSaveError("First name is required.");
      setSaveMessage(null);
      return;
    }
    const parsedAge = age.trim() === "" ? undefined : Math.round(Number(age));
    if (age.trim() !== "" && !Number.isFinite(parsedAge)) {
      setSaveError("Age must be a number.");
      setSaveMessage(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    // Keep the name identical to how the student signs in: trimmed, single
    // spaces. Attendance and reviews snapshot the name at write time, so older
    // rows keep the old spelling by design (see AGENTS.md).
    const fullName = `${firstName.trim()} ${lastName.trim()}`
      .replace(/\s+/g, " ")
      .trim();
    // Trim each link and turn a blank one into undefined so the column is
    // written as NULL (a cleared link is removed) rather than an empty string.
    const socialPayload = Object.fromEntries(
      SOCIAL_FIELDS.map(({ key }) => [key, social[key].trim() || undefined]),
    ) as Pick<Student, SocialKey>;

    try {
      await updateStudentProfile(student.id, {
        fullName,
        program: student.program,
        training: student.training,
        phone: student.phone,
        email: student.email,
        location: location.trim() || undefined,
        education: student.education,
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        engagement: engagement.trim() || undefined,
        ...socialPayload,
      });
      // Same values in the per-portal profile row, which is what the top bar
      // and the portal header render from.
      await saveUserProfile({
        ...profileBase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        linkedinUrl: social.linkedin.trim() || undefined,
        whatsappNumber: social.whatsapp.trim() || undefined,
        githubUrl: social.github.trim() || undefined,
      });
      const next: Student = {
        ...student,
        fullName,
        location: location.trim() || undefined,
        age: Number.isFinite(parsedAge) ? parsedAge : undefined,
        engagement: engagement.trim() || undefined,
        ...socialPayload,
      } as Student;
      onSaved(next);
      setSaveMessage("Changes saved.");
      // The portal top bar shows the record loaded by StudentLayout; ask it to
      // re-read so a new name appears without a reload.
      notifyStudentProfileChanged();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>
            Shown in the top bar of the student portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <UserAvatar
              name={previewName}
              src={avatar ?? undefined}
              fallback="S"
              className="h-20 w-20 border-2 text-xl"
            />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {avatarBusy ? "Uploading…" : "Upload photo"}
                </Button>
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveAvatar}
                    disabled={avatarBusy}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={urlDraft}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  aria-label="Image URL"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseUrl}
                  disabled={!urlDraft.trim() || avatarBusy}
                >
                  Use URL
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Uploaded to the profilePictuer Storage bucket; the public URL is
                saved on your profile (user_profiles) and shown across the
                portal.
              </p>
              {avatarError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {avatarError}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            Your name is also how you sign in to the student portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-first-name">First Name (Prénom)</Label>
              <Input
                id="student-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-last-name">Last Name (Nom)</Label>
              <Input
                id="student-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-email">Email (read-only)</Label>
            <Input
              id="student-email"
              value={student.email || "—"}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              {student.program}
              {student.training ? ` — ${student.training}` : ""} · managed by
              the administration.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="student-location">Location</Label>
              <Input
                id="student-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Your location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-age">Age</Label>
              <Input
                id="student-age"
                type="number"
                min={0}
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="Your age"
              />
            </div>
            <div className="space-y-2">
              <Label>Engagement</Label>
              <Select
                value={engagement}
                onValueChange={(value) => setEngagement(value ?? "")}
              >
                <SelectTrigger className="w-full">
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social media &amp; contact links</CardTitle>
          <CardDescription>
            Optional links to your profiles. Leave a field empty to remove it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`student-${key}`}>{label}</Label>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <span
                  aria-hidden="true"
                  className="flex items-center border-r border-input bg-muted/60 px-2.5 text-muted-foreground"
                >
                  <FontAwesomeIcon icon={icon} className="text-sm" />
                </span>
                <Input
                  id={`student-${key}`}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={social[key]}
                  onChange={(event) =>
                    setSocial((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  placeholder={placeholder}
                  className="rounded-none border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );
}

function GeneralTab() {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setDarkMode(settings.darkMode === true);
        setLanguage(settings.language);
      })
      .catch(() => {
        // Settings table missing — the local cache fallback still applies.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) applyDarkMode(darkMode);
  }, [darkMode, loading]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const persist = async (patch: { darkMode?: boolean; language?: string }) => {
    setError(null);
    setStatus(null);
    try {
      // Dark mode and language are global settings in this deployment (same as
      // the operator Settings page), so read-modify-write rather than blanking
      // the other keys.
      const settings = await getSettings();
      await saveSettings({ ...settings, ...patch });
      setStatus("Preferences saved.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    // Apply immediately; the persisted copy follows.
    applyDarkMode(checked);
    void persist({ darkMode: checked });
  };

  const handleLanguage = (value: string) => {
    setLanguage(value);
    void persist({ language: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Display preferences for this deployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <DataLoading label="Loading preferences…" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Dark mode</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Applies the dark theme across the whole app.
                </p>
              </div>
              <Switch checked={darkMode} onCheckedChange={handleDarkMode} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={language ?? ""}
                onValueChange={(value) => value && handleLanguage(value)}
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
              <p className="text-xs text-muted-foreground">
                Stored as the app-wide language preference.
              </p>
            </div>

            {(status || error) && (
              <p
                className={
                  error
                    ? "text-sm text-red-600 dark:text-red-400"
                    : "text-sm text-green-600 dark:text-green-400"
                }
              >
                {error ?? status}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
