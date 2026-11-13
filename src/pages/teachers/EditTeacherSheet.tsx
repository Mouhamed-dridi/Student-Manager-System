// Side-drawer editor for a teacher's profile, the teacher counterpart of
// EditStudentSheet. The profile page owns the "Edit Profile" trigger and this
// sheet writes through `updateTeacherProfile`, then mirrors the name and social
// links into `user_profiles`, and finally hands the saved record back so the
// page (and the list behind it) update without a reload.
//
// Two schema limits shape the form:
// - a teacher stores ONE `program` code (CAP/BTP/BTS) plus one `training` name,
//   both free text, so the branch selector is a single choice rather than a
//   multi-select;
// - there is no status/lifecycle column, only `blocked`, which is what stops a
//   teacher from signing in, so status reads Active/Blocked.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  deleteProfilePicture,
  errorMessage,
  getUserProfile,
  listPrograms,
  listTrainings,
  updateTeacherAvatar,
  updateTeacherProfile,
  uploadProfilePicture,
} from "@/lib/api";
import { saveUserProfile, useUserProfile } from "@/lib/userProfile";
import type { Teacher } from "./TeacherForm";

interface EditTeacherSheetProps {
  teacher: Teacher;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved record so the profile view can refresh in place. */
  onSaved: (teacher: Teacher) => void;
}

export default function EditTeacherSheet({
  teacher,
  open,
  onOpenChange,
  onSaved,
}: EditTeacherSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-lg lg:max-w-2xl"
      >
        {/* Remounting per open resets the draft and keeps the close animation. */}
        <EditTeacherForm
          key={`${teacher.id}:${open}`}
          teacher={teacher}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

interface ProgramOption {
  id: string;
  code: string;
}

interface TrainingOption {
  id: string;
  name: string;
  programId: string;
}

function EditTeacherForm({
  teacher,
  onSaved,
  onClose,
}: {
  teacher: Teacher;
  onSaved: (teacher: Teacher) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(teacher.fullName ?? "");
  const [specialty, setSpecialty] = useState(teacher.specialty ?? "");
  const [program, setProgram] = useState<string | null>(teacher.program ?? null);
  const [training, setTraining] = useState(teacher.training ?? "");
  const [phone, setPhone] = useState(teacher.phone ?? "");
  const [email, setEmail] = useState(teacher.email ?? "");
  const [location, setLocation] = useState(teacher.location ?? "");
  const [jobTitle, setJobTitle] = useState(teacher.jobTitle ?? "");
  const [company, setCompany] = useState(teacher.company ?? "");
  const [education, setEducation] = useState(teacher.education ?? "");
  const [blocked, setBlocked] = useState(Boolean(teacher.blocked));
  const [linkedin, setLinkedin] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [github, setGithub] = useState("");

  // The photo itself is stored in `user_profiles` (read reactively, so the
  // sheet preview and the profile header update together) and mirrored onto
  // `teachers.avatar_url` for readers that only have the teacher row.
  const userProfile = useUserProfile("teacher", teacher.id);
  const avatar = userProfile?.avatarUrl ?? teacher.avatarUrl;
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPrograms(), listTrainings(), getUserProfile(teacher.id, "teacher")])
      .then(([programs, trainings, profile]) => {
        if (cancelled) return;
        setProgramOptions(programs.map((p) => ({ id: p.id, code: p.code })));
        setAllTrainings(
          trainings.map((t) => ({
            id: t.id,
            name: t.name,
            programId: t.program_id,
          })),
        );
        setLinkedin(profile?.linkedinUrl ?? "");
        setWhatsapp(profile?.whatsappNumber ?? "");
        setGithub(profile?.githubUrl ?? "");
      })
      .catch((err: unknown) => {
        // The links and options are optional extras: a failure here must not
        // stop the operator from editing the teacher's core details.
        if (!cancelled) setOptionsError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher.id]);

  const selectedProgramId = useMemo(
    () => programOptions.find((p) => p.code === program)?.id,
    [program, programOptions],
  );

  const trainingChoices = useMemo(() => {
    const names = selectedProgramId
      ? allTrainings
          .filter((t) => t.programId === selectedProgramId)
          .map((t) => t.name)
      : [];
    // Keep the record's current training visible even when it is no longer in
    // the trainings table, so opening the sheet never silently drops it.
    if (training && !names.includes(training)) return [training, ...names];
    return names;
  }, [selectedProgramId, allTrainings, training]);

  const handleProgramChange = (value: string | null) => {
    setProgram(value);
    setTraining("");
  };

  /**
   * The row as it must be written: the upsert replaces every column, so the
   * current name and social links are carried over instead of being cleared.
   */
  const profileRow = (base: Awaited<ReturnType<typeof getUserProfile>>) => {
    const [draftFirst, ...draftRest] = (fullName.trim() || teacher.fullName).split(
      " ",
    );
    return {
      userId: teacher.id,
      role: "teacher" as const,
      firstName: base?.firstName || draftFirst,
      lastName: base?.lastName || draftRest.join(" "),
      linkedinUrl: linkedin.trim() || undefined,
      whatsappNumber: whatsapp.trim() || undefined,
      githubUrl: github.trim() || undefined,
    };
  };

  const handleAvatarFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
      const base = userProfile ?? (await getUserProfile(teacher.id, "teacher"));
      const previous = base?.avatarUrl;
      await saveUserProfile({ ...profileRow(base), avatarUrl: uploaded });
      // Row mirror; databases without the migration simply skip it.
      void updateTeacherAvatar(teacher.id, uploaded).catch(() => {});
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
    try {
      const base = userProfile ?? (await getUserProfile(teacher.id, "teacher"));
      const previous = base?.avatarUrl ?? teacher.avatarUrl;
      await saveUserProfile({ ...profileRow(base), avatarUrl: undefined });
      void updateTeacherAvatar(teacher.id, null).catch(() => {});
      if (previous) void deleteProfilePicture(previous).catch(() => {});
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const name = fullName.replace(/\s+/g, " ").trim();
    if (!name) {
      setError("Full name is required.");
      return;
    }
    if (!specialty.trim()) {
      setError("Main subject / speciality is required.");
      return;
    }

    const profile = {
      fullName: name,
      specialty: specialty.trim(),
      phone: phone.trim(),
      email: email.trim(),
      jobTitle: jobTitle.trim() || undefined,
      company: company.trim() || undefined,
      location: location.trim() || undefined,
      education: education.trim() || undefined,
      program: (program as Teacher["program"]) ?? undefined,
      training: training || undefined,
      blocked,
    };

    setSaving(true);
    setError(null);
    try {
      await updateTeacherProfile(teacher.id, profile);

      // `user_profiles` is the per-portal home of the social links. The upsert
      // rewrites every column, so the current avatar is carried over instead of
      // being cleared.
      const [firstName, ...rest] = name.split(" ");
      await saveUserProfile({
        userId: teacher.id,
        role: "teacher",
        firstName,
        lastName: rest.join(" "),
        avatarUrl: userProfile?.avatarUrl ?? teacher.avatarUrl,
        linkedinUrl: linkedin.trim() || undefined,
        whatsappNumber: whatsapp.trim() || undefined,
        githubUrl: github.trim() || undefined,
      });

      onSaved({
        ...teacher,
        ...profile,
        avatarUrl: userProfile?.avatarUrl ?? teacher.avatarUrl,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <SheetHeader className="border-b px-6 py-4 pr-14">
        <SheetTitle>Edit teacher profile</SheetTitle>
        <SheetDescription>
          Update {teacher.fullName}'s details. Changes save straight to Supabase.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {optionsError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load programs, trainings and social links: {optionsError}
          </p>
        )}

        <div className="flex items-start gap-4 rounded-lg border bg-muted/30 p-4">
          <UserAvatar
            name={fullName.trim() || teacher.fullName}
            src={avatar}
            fallback="T"
            className="h-20 w-20 border-2 text-xl"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Profile photo</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {avatarBusy
                  ? "Uploading…"
                  : avatar
                    ? "Replace photo"
                    : "Upload photo"}
              </Button>
              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Saves to the profilePictuer bucket right away, so the profile
              header, this sheet and the teachers list update immediately.
            </p>
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-teacher-name">Full name</Label>
            <Input
              id="edit-teacher-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              required
            />
            <p className="text-xs text-muted-foreground">
              Teachers sign in with this exact name, so changing it changes their
              login.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-teacher-specialty">Main subject / speciality</Label>
            <Input
              id="edit-teacher-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Cybersecurity & Networking"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={blocked ? "blocked" : "active"}
              onValueChange={(value) => setBlocked(value === "blocked")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Blocked teachers cannot sign in to the teacher portal.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Program / branch</Label>
            <Select value={program} onValueChange={handleProgramChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programOptions.map((option) => (
                  <SelectItem key={option.id} value={option.code}>
                    {option.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Training</Label>
            <Select
              value={training}
              onValueChange={(value) => setTraining(value ?? "")}
              disabled={!program}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select training" />
              </SelectTrigger>
              <SelectContent>
                {trainingChoices.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {program && !loadingOptions && !selectedProgramId && (
              <p className="text-xs text-muted-foreground">
                This program is not in the programs table, so it cannot be saved.
                Run supabase/schema.sql.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-teacher-phone">Phone number</Label>
            <Input
              id="edit-teacher-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6 12 34 56 78"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-teacher-email">Email</Label>
            <Input
              id="edit-teacher-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-teacher-location">Location</Label>
            <Input
              id="edit-teacher-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or address"
            />
          </div>
        </div>

        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold">Professional</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-job-title">Job title</Label>
              <Input
                id="edit-teacher-job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Job title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-company">Company</Label>
              <Input
                id="edit-teacher-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-teacher-education">Education</Label>
              <Input
                id="edit-teacher-education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="Highest qualification"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold">Social links</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-linkedin">LinkedIn</Label>
              <Input
                id="edit-teacher-linkedin"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="URL or username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-teacher-whatsapp">WhatsApp</Label>
              <Input
                id="edit-teacher-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-teacher-github">GitHub</Label>
              <Input
                id="edit-teacher-github"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username"
              />
            </div>
          </div>
        </div>
      </div>

      <SheetFooter className="mt-0 flex-row items-center justify-between gap-2 border-t px-6 py-4">
        {error ? (
          <p className="min-w-0 flex-1 text-xs text-destructive">{error}</p>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">
            {loadingOptions ? "Loading programs…" : ""}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Save changes
              </span>
            )}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
