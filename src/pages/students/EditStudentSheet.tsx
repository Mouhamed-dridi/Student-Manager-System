// Side-drawer editor for a student's profile. It replaces the old full-page
// edit form: the profile page owns the "Edit profile" trigger and this sheet
// writes through `updateStudentProfile`, then hands the saved record back so
// the page (and the list behind it) updates without a reload.
//
// Program/training come from the `programs`/`trainings` tables — the same
// source the Add Student form uses — because `updateStudentProfile` re-resolves
// their ids on save. Training is filtered by the chosen program.

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
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
  errorMessage,
  getUserProfile,
  listPrograms,
  listTrainings,
  updateStudentProfile,
} from "@/lib/api";
import { saveUserProfile } from "@/lib/userProfile";
import type { Student } from "./StudentForm";
import { EDUCATION_OPTIONS, ENGAGEMENT_OPTIONS } from "./studentOptions";

interface EditStudentSheetProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the saved record so the profile view can refresh in place. */
  onSaved: (student: Student) => void;
}

export default function EditStudentSheet({
  student,
  open,
  onOpenChange,
  onSaved,
}: EditStudentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-lg lg:max-w-2xl"
      >
        {/* Remounting per open resets the draft and keeps the close animation. */}
        <EditStudentForm
          key={`${student.id}:${open}`}
          student={student}
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

function EditStudentForm({
  student,
  onSaved,
  onClose,
}: {
  student: Student;
  onSaved: (student: Student) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(student.fullName ?? "");
  const [program, setProgram] = useState<Student["program"] | null>(
    student.program ?? null,
  );
  const [training, setTraining] = useState(student.training ?? "");
  const [phone, setPhone] = useState(student.phone ?? "");
  const [email, setEmail] = useState(student.email ?? "");
  const [location, setLocation] = useState(student.location ?? "");
  const [age, setAge] = useState(student.age != null ? String(student.age) : "");
  const [education, setEducation] = useState(student.education ?? "");
  const [engagement, setEngagement] = useState(student.engagement ?? "");
  const [blocked, setBlocked] = useState(Boolean(student.blocked));
  const [facebook, setFacebook] = useState(student.facebook ?? "");
  const [instagram, setInstagram] = useState(student.instagram ?? "");
  const [whatsapp, setWhatsapp] = useState(student.whatsapp ?? "");
  const [github, setGithub] = useState(student.github ?? "");
  const [linkedin, setLinkedin] = useState(student.linkedin ?? "");

  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPrograms(), listTrainings()])
      .then(([programs, trainings]) => {
        if (cancelled) return;
        setProgramOptions(
          programs.map((p) => ({ id: p.id, code: p.code })),
        );
        setAllTrainings(
          trainings.map((t) => ({
            id: t.id,
            name: t.name,
            programId: t.program_id,
          })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setOptionsError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setProgram(value as Student["program"] | null);
    setTraining("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const name = fullName.replace(/\s+/g, " ").trim();
    if (!name) {
      setError("Full name is required.");
      return;
    }
    if (!program || !training) {
      setError("Choose a program and a training.");
      return;
    }
    const parsedAge = age.trim() === "" ? undefined : Math.round(Number(age));
    if (age.trim() !== "" && !Number.isFinite(parsedAge)) {
      setError("Age must be a number.");
      return;
    }

    const profile = {
      fullName: name,
      program,
      training,
      phone: phone.trim(),
      email: email.trim(),
      location: location.trim() || undefined,
      education: education || undefined,
      age: Number.isFinite(parsedAge) ? parsedAge : undefined,
      engagement: engagement || undefined,
      facebook: facebook.trim() || undefined,
      instagram: instagram.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      github: github.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      blocked,
    };

    setSaving(true);
    setError(null);
    try {
      await updateStudentProfile(student.id, profile);

      // Mirror the name into `user_profiles` when the student already has a
      // portal row (that row is what the student portal header renders from).
      // Creating one here would change the student's portal display, so it is
      // only updated — never inserted.
      const existing = await getUserProfile(student.id, "student");
      if (existing) {
        const [firstName, ...rest] = name.split(" ");
        await saveUserProfile({
          ...existing,
          firstName,
          lastName: rest.join(" "),
        });
      }

      onSaved({ ...student, ...profile, fullName: name });
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
        <SheetTitle>Edit student profile</SheetTitle>
        <SheetDescription>
          Update {student.fullName}'s details. Changes save straight to Supabase.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {optionsError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load programs and trainings: {optionsError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-student-name">Full name</Label>
            <Input
              id="edit-student-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Program</Label>
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
                This program is not in the programs table, so it cannot be
                saved. Run supabase/schema.sql.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-student-phone">Phone number</Label>
            <Input
              id="edit-student-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6 12 34 56 78"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-student-email">Email</Label>
            <Input
              id="edit-student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-student-location">Location</Label>
            <Input
              id="edit-student-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or address"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-student-age">Age</Label>
            <Input
              id="edit-student-age"
              type="number"
              min={1}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Education level</Label>
            <Select
              value={education}
              onValueChange={(value) => setEducation(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
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
              Blocked students cannot sign in to the student portal.
            </p>
          </div>
        </div>

        <div className="border-t pt-5">
          <h3 className="text-sm font-semibold">Social links</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-student-facebook">Facebook</Label>
              <Input
                id="edit-student-facebook"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="URL or username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-student-instagram">Instagram</Label>
              <Input
                id="edit-student-instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-student-whatsapp">WhatsApp</Label>
              <Input
                id="edit-student-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-student-github">GitHub</Label>
              <Input
                id="edit-student-github"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-student-linkedin">LinkedIn</Label>
              <Input
                id="edit-student-linkedin"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="URL or username"
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
            disabled={saving || !program || !training}
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
