import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
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
  errorMessage,
  getSettings,
  saveSettings,
  updateTeacherProfile,
} from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import {
  fileToAvatarDataUrl,
  loadTeacherSocialLinks,
  notifyTeacherProfileChanged,
  saveTeacherAvatar,
  saveTeacherSocialLinks,
  useTeacherAvatar,
} from "@/lib/teacherProfile";
import type { TeacherSocialLinks } from "@/lib/teacherProfile";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

/** "Ada Lovelace" -> { first: "Ada", last: "Lovelace" }; extra words stay in the last name. */
function splitFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function TeacherSettingsPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then((record) => {
        if (!cancelled) setTeacher(record);
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teacher === undefined) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <DataLoading label="Loading settings…" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your teacher record could not be found. It may have been removed by
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
          <ProfileTab key={teacher.id} teacher={teacher} />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <GeneralTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The three social platforms a teacher can fill in. Stored per teacher in this
// browser (the teachers table has no linkedin/whatsapp/github columns), the
// same trade-off as the avatar above.
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
] as const;

function SocialLinksCard({ teacherId }: { teacherId: string }) {
  const [links, setLinks] = useState<TeacherSocialLinks>(() =>
    loadTeacherSocialLinks(teacherId),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const handleChange = (key: keyof TeacherSocialLinks, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
    setLinkError(null);
  };

  const handleSave = () => {
    setMessage(null);
    setLinkError(null);
    try {
      saveTeacherSocialLinks(teacherId, links);
      setMessage("Links saved in this browser.");
    } catch (err) {
      setLinkError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social links</CardTitle>
        <CardDescription>
          Optional links to your professional profiles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`teacher-${key}`}>{label}</Label>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
              <span
                aria-hidden="true"
                className="flex items-center border-r border-input bg-muted/60 px-2.5 text-muted-foreground"
              >
                <FontAwesomeIcon icon={icon} className="text-sm" />
              </span>
              <Input
                id={`teacher-${key}`}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={links[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                placeholder={placeholder}
                className="rounded-none border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Saved in this browser only — the teachers table has no social-media
          columns, so nothing is uploaded to the database.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave}>Save Links</Button>
          {message && (
            <p className="text-sm text-green-600 dark:text-green-400">
              {message}
            </p>
          )}
          {linkError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {linkError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileTab({ teacher }: { teacher: Teacher }) {
  const initial = splitFullName(teacher.fullName);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const avatar = useTeacherAvatar(teacher.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = window.setTimeout(() => setSaveMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const previewName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || teacher.fullName;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file again still fires change.
    event.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      saveTeacherAvatar(teacher.id, await fileToAvatarDataUrl(file));
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleUseUrl = () => {
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
    try {
      saveTeacherAvatar(teacher.id, value);
      setUrlDraft("");
      setAvatarError(null);
    } catch (err) {
      setAvatarError(errorMessage(err));
    }
  };

  const handleRemoveAvatar = () => {
    try {
      saveTeacherAvatar(teacher.id, null);
      setAvatarError(null);
    } catch (err) {
      setAvatarError(errorMessage(err));
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      setSaveError("First name is required.");
      setSaveMessage(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const fullName = `${firstName.trim()} ${lastName.trim()}`
      .replace(/\s+/g, " ")
      .trim();
    try {
      // Only the identity fields change here; everything else is passed through
      // untouched so the operator's record is not rewritten with guesses.
      await updateTeacherProfile(teacher.id, {
        fullName,
        specialty: teacher.specialty,
        phone: teacher.phone,
        email: teacher.email,
        jobTitle: teacher.jobTitle,
        company: teacher.company,
        location: teacher.location,
        education: teacher.education,
        program: teacher.program,
        training: teacher.training,
      });
      setSaveMessage("Changes saved.");
      // The navbar and header show the record loaded by TeacherLayout; ask it to
      // re-read so a new name appears without a reload.
      notifyTeacherProfileChanged();
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
            Shown in the top bar of the teacher portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <UserAvatar
              name={previewName}
              src={avatar ?? undefined}
              fallback="T"
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
                  {avatarBusy ? "Preparing…" : "Upload photo"}
                </Button>
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveAvatar}
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
                  disabled={!urlDraft.trim()}
                >
                  Use URL
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Saved in this browser only — the teachers table has no photo
                column, so nothing is uploaded to the database. A picked image
                is downscaled to 256px before it is stored.
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
            Your name is also how you sign in to the teacher portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-first-name">First Name (Prénom)</Label>
              <Input
                id="teacher-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-last-name">Last Name (Nom)</Label>
              <Input
                id="teacher-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-email">Login email (read-only)</Label>
            <Input
              id="teacher-email"
              value={teacher.email || "—"}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Managed by the administration and cannot be changed here.
            </p>
          </div>

          <Separator />

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
              <p className="text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <SocialLinksCard key={teacher.id} teacherId={teacher.id} />
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
              <Select value={language ?? ""} onValueChange={(value) => value && handleLanguage(value)}>
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
