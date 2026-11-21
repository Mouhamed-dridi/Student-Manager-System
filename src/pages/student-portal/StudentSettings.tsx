import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AlertCircle, Check, ImagePlus, Trash2 } from "lucide-react";
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
  deleteProfilePicture,
  errorMessage,
  getSettings,
  saveSettings,
  updateStudentProfile,
  uploadProfilePicture,
} from "@/lib/api";
import type { UserProfile } from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { setTheme, useTheme } from "@/lib/theme";
import { setLanguage as applyLanguage, useI18n } from "@/lib/i18n";
import { notifyStudentProfileChanged } from "@/lib/studentProfile";
import {
  loadUserProfile,
  saveUserProfile,
  useUserProfile,
  userProfileFullName,
} from "@/lib/userProfile";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

const ENGAGEMENT_OPTIONS = [
  { value: "New Student", labelKey: "New Student" },
  { value: "Second Year", labelKey: "Second Year" },
] as const;

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
  const { t } = useI18n();
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
        <h2 className="text-2xl font-semibold">{t("Settings")}</h2>
        <DataLoading label={t("Loading settings…")} />
      </div>
    );
  }

  if (!student) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">{t("Settings")}</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "Your student record could not be found. It may have been removed by the administration.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold">{t("Settings")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Manage your profile and display preferences.")}
      </p>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList variant="line" className="border-b border-zinc-200 dark:border-zinc-800">
          <TabsTrigger value="profile">{t("Profile")}</TabsTrigger>
          <TabsTrigger value="general">{t("General Settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab key={student.id} student={student} onSaved={setStudent} />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <GeneralTab student={student} />
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
  const { t } = useI18n();
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
    event.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    let uploaded: string | undefined;
    try {
      uploaded = await uploadProfilePicture(student.id, file);
      const previous = avatar;
      await saveUserProfile({ ...profileBase(), avatarUrl: uploaded });
      if (previous && previous !== uploaded) {
        void deleteProfilePicture(previous).catch(() => {});
      }
    } catch (err) {
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
      setSaveError(t("First name is required."));
      setSaveMessage(null);
      return;
    }
    const parsedAge = age.trim() === "" ? undefined : Math.round(Number(age));
    if (age.trim() !== "" && !Number.isFinite(parsedAge)) {
      setSaveError(t("Age must be a number."));
      setSaveMessage(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`
      .replace(/\s+/g, " ")
      .trim();

    // Trim each link and turn a blank/whitespace-only one into undefined so it is cleared in SQL
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
      setSaveMessage(t("Changes saved."));
      notifyStudentProfileChanged();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Left Column: Photo & Personal Information */}
        <div className="space-y-6">
          {/* Profile photo */}
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("Profile photo")}</CardTitle>
              <CardDescription>
                {t("Shown in the top bar of the student portal.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <UserAvatar
                  name={previewName}
                  src={avatar ?? undefined}
                  fallback="S"
                  className="h-20 w-20 border border-zinc-200 text-xl dark:border-zinc-800"
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
                      className="border-zinc-200 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarBusy}
                    >
                      <ImagePlus className="mr-2 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                      {avatarBusy ? t("Saving…") : t("Upload photo")}
                    </Button>
                    {avatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        onClick={handleRemoveAvatar}
                        disabled={avatarBusy}
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        {t("Remove")}
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("Accepted formats: JPG, PNG, or WebP (max 2 MB).")}
                  </p>
                  {avatarError && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-800 dark:text-zinc-200">
                      <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
                      {avatarError}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information & Academic Details */}
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("Personal Information")}</CardTitle>
              <CardDescription>
                {t("Your name is also how you sign in to the student portal.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Academic Branch notice */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("Academic Branch & Class")}
                  </span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {t("Admin-managed")}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {student.program}
                  {student.training ? ` — ${student.training}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="student-first-name">{t("First Name")}</Label>
                  <Input
                    id="student-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder={t("First name")}
                    autoComplete="given-name"
                    className="border-zinc-200 bg-white focus-visible:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-visible:ring-zinc-100/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-last-name">{t("Last Name")}</Label>
                  <Input
                    id="student-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder={t("Last name")}
                    autoComplete="family-name"
                    className="border-zinc-200 bg-white focus-visible:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-visible:ring-zinc-100/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-email">
                  {t("Email")} ({t("read-only")})
                </Label>
                <Input
                  id="student-email"
                  value={student.email || "—"}
                  disabled
                  readOnly
                  className="border-zinc-200 bg-zinc-50 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="student-location">{t("Location")}</Label>
                  <Input
                    id="student-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder={t("Your location")}
                    className="border-zinc-200 bg-white focus-visible:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-visible:ring-zinc-100/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-age">{t("Age")}</Label>
                  <Input
                    id="student-age"
                    type="number"
                    min={0}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder={t("Your age")}
                    className="border-zinc-200 bg-white tabular-nums focus-visible:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-visible:ring-zinc-100/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Engagement")}</Label>
                  <Select
                    value={engagement}
                    onValueChange={(value) => setEngagement(value ?? "")}
                  >
                    <SelectTrigger className="w-full border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                      <SelectValue placeholder={t("Select engagement")} />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-200 dark:border-zinc-800">
                      {ENGAGEMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Social Media & Contact Links */}
        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("Social media & contact links")}
              </CardTitle>
              <CardDescription>
                {t("Optional links to your profiles. Leave a field empty to remove it.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`student-${key}`} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {label}
                  </Label>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-200 transition-colors focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-within:border-zinc-100 dark:focus-within:ring-zinc-100/10">
                    <span
                      aria-hidden="true"
                      className="flex items-center border-r border-zinc-200 bg-zinc-50 px-3 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
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
                      className="rounded-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Button & Feedback (below the 2-column grid) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full sm:w-auto border border-transparent bg-zinc-900 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {saving ? t("Saving…") : t("Save changes")}
        </Button>

        {saveMessage && (
          <div className="flex w-full sm:w-auto items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100">
            <Check className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            {saveMessage}
          </div>
        )}

        {saveError && (
          <div className="flex w-full sm:w-auto items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3.5 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <AlertCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}

function GeneralTab({ student }: { student: Student }) {
  const { t } = useI18n();
  const theme = useTheme();
  const darkMode = theme === "dark";
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setTheme(settings.darkMode === true ? "dark" : "light");
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
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const persist = async (patch: { darkMode?: boolean; language?: string }) => {
    setError(null);
    setStatus(null);
    try {
      const settings = await getSettings();
      await saveSettings({ ...settings, ...patch });
      setStatus("Preferences saved.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleDarkMode = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
    void persist({ darkMode: checked });
  };

  const handleLanguage = (value: string) => {
    setLanguage(value);
    applyLanguage(value === "fr" ? "fr" : "en");
    void persist({ language: value });
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Display Preferences */}
      <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t("General Settings")}</CardTitle>
          <CardDescription>
            {t("Display preferences for this deployment.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <DataLoading label={t("Loading preferences…")} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">{t("Dark mode")}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Applies the dark theme across the whole app.")}
                  </p>
                </div>
                <Switch checked={darkMode} onCheckedChange={handleDarkMode} />
              </div>

              <Separator className="bg-zinc-200 dark:bg-zinc-800" />

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("Language")}</Label>
                <Select
                  value={language ?? ""}
                  onValueChange={(value) => value && handleLanguage(value)}
                >
                  <SelectTrigger className="w-full border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                    <SelectValue placeholder={t("Select language")} />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-200 dark:border-zinc-800">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("Stored as the app-wide language preference.")}
                </p>
              </div>

              {status && (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100">
                  <Check className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                  {t(status)}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3.5 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <AlertCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  {error}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t("Account Information")}</CardTitle>
          <CardDescription>
            {t("Summary of your registered student account.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <span className="text-xs font-medium text-muted-foreground">{t("Full Name")}</span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {student.fullName}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <span className="text-xs font-medium text-muted-foreground">{t("Academic Branch")}</span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {student.program}
              {student.training ? ` — ${student.training}` : ""}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <span className="text-xs font-medium text-muted-foreground">{t("Email")}</span>
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {student.email || "—"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-medium text-muted-foreground">{t("Account Status")}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-800 dark:bg-zinc-200" />
              {t("Active")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
