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
  deleteProfilePicture,
  errorMessage,
  getSettings,
  saveSettings,
  updateTeacherProfile,
  uploadProfilePicture,
} from "@/lib/api";
import type { UserProfile } from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import {
  loadTeacherSocialLinks,
  notifyTeacherProfileChanged,
  saveTeacherSocialLinks,
} from "@/lib/teacherProfile";
import type { TeacherSocialLinks } from "@/lib/teacherProfile";
import {
  loadUserProfile,
  saveUserProfile,
  useUserProfile,
  userProfileFullName,
} from "@/lib/userProfile";
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
  // The form must not mount before the user_profiles row is known, otherwise
  // the inputs would start from the teachers-table fallback and a save would
  // write those stale values back over the database ones.
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled) return;
        setTeacher(record);
        if (!record) return;
        // Failure here only means "no row / table missing"; the form then falls
        // back to the teachers record.
        await loadUserProfile("teacher", record.id).catch(() => null);
        if (!cancelled) setProfileReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setTeacher(null);
          setProfileReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teacher === undefined || (teacher && !profileReady)) {
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

function SocialLinksCard({
  teacherId,
  profile,
  firstName,
  lastName,
  avatarUrl,
}: {
  teacherId: string;
  profile: UserProfile | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}) {
  const [links, setLinks] = useState<TeacherSocialLinks>(() => {
    // Database first; the localStorage mirror only fills gaps for accounts
    // whose links were saved before user_profiles existed.
    const local = loadTeacherSocialLinks(teacherId);
    return {
      linkedin: profile?.linkedinUrl ?? local.linkedin,
      whatsapp: profile?.whatsappNumber ?? local.whatsapp,
      github: profile?.githubUrl ?? local.github,
    };
  });
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    setMessage(null);
    setLinkError(null);
    setSaving(true);
    const next: TeacherSocialLinks = {
      linkedin: links.linkedin.trim(),
      whatsapp: links.whatsapp.trim(),
      github: links.github.trim(),
    };
    try {
      // A blank link is written as NULL so "cleared" really removes it.
      await saveUserProfile({
        userId: teacherId,
        role: "teacher",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl,
        linkedinUrl: next.linkedin || undefined,
        whatsappNumber: next.whatsapp || undefined,
        githubUrl: next.github || undefined,
      });
      try {
        saveTeacherSocialLinks(teacherId, next);
      } catch {
        // Local mirror only — the database copy already succeeded.
      }
      setMessage("Links saved.");
    } catch (err) {
      setLinkError(errorMessage(err));
    } finally {
      setSaving(false);
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
          Stored on your profile (user_profiles) and mirrored in this browser.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Links"}
          </Button>
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
  // The user_profiles row is the source for the name/photo shown in the top
  // bar; the teachers record is only the fallback for accounts created before
  // this table existed.
  const profile = useUserProfile("teacher", teacher.id);
  const initial = splitFullName(userProfileFullName(profile) || teacher.fullName);
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const avatar = profile?.avatarUrl;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  /**
   * The row as it should be written: server values plus whatever the form is
   * currently holding. Every partial save (photo, links) needs the whole row
   * because the upsert replaces it, and blanking the other columns would lose
   * data the person never touched.
   */
  const profileBase = (): UserProfile => ({
    userId: teacher.id,
    role: "teacher",
    firstName: firstName.trim() || profile?.firstName || initial.first,
    lastName: lastName.trim() || profile?.lastName || initial.last,
    avatarUrl: avatar ?? undefined,
    linkedinUrl: profile?.linkedinUrl,
    whatsappNumber: profile?.whatsappNumber,
    githubUrl: profile?.githubUrl,
  });

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
    let uploaded: string | undefined;
    try {
      // Storage first: the row only ever points at an object that exists.
      uploaded = await uploadProfilePicture(teacher.id, file);
      const previous = avatar;
      await saveUserProfile({ ...profileBase(), avatarUrl: uploaded });
      // The replaced object is no longer referenced — drop it, but never let
      // that failure surface (the new photo is already live).
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
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const fullName = `${firstName.trim()} ${lastName.trim()}`
      .replace(/\s+/g, " ")
      .trim();
    try {
      // The name is also the login identity and what the operator's lists show,
      // so the people table stays in step with the profile row.
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
      await saveUserProfile({
        ...profileBase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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

      <SocialLinksCard
        key={teacher.id}
        teacherId={teacher.id}
        profile={profile}
        // Server values only: saving links must not smuggle in an unsaved
        // name edit that the teachers row has not seen yet.
        firstName={profile?.firstName ?? initial.first}
        lastName={profile?.lastName ?? initial.last}
        avatarUrl={avatar ?? undefined}
      />
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
