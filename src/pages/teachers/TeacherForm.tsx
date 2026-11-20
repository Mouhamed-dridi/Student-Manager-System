import { useEffect, useMemo, useState } from "react";
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
import { listPrograms, listTrainings } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { DEFAULT_TEACHER_PASSWORD } from "@/pages/users/userAccounts";

export interface Teacher {
  id: string;
  fullName: string;
  specialty: string;
  phone: string;
  email: string;
  program?: "BTP" | "BTS" | "CAP";
  training?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  education?: string;
  password?: string;
  blocked?: boolean;
  /** Photo URL; `user_profiles.avatar_url` wins, this is the teachers-row mirror. */
  avatarUrl?: string;
}

interface TeacherFormProps {
  initialData?: Teacher;
  onSave: (teacher: Teacher) => void;
  onCancel: () => void;
}

export default function TeacherForm({
  initialData,
  onSave,
  onCancel,
}: TeacherFormProps) {
  const t = useT();
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [specialty, setSpecialty] = useState(initialData?.specialty ?? "");
  const [program, setProgram] = useState<string | null>(
    initialData?.program ?? null,
  );
  const [training, setTraining] = useState(initialData?.training ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [jobTitle, setJobTitle] = useState(initialData?.jobTitle ?? "");
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [education, setEducation] = useState(initialData?.education ?? "");
  const [password, setPassword] = useState(
    initialData?.password ?? DEFAULT_TEACHER_PASSWORD,
  );

  const [programOptions, setProgramOptions] = useState<
    { id: string; code: string }[]
  >([]);
  const [allTrainings, setAllTrainings] = useState<
    { id: string; name: string; programId: string }[]
  >([]);

  useEffect(() => {
    listPrograms().then(setProgramOptions).catch(() => {});
    listTrainings()
      .then((rows) =>
        setAllTrainings(
          rows.map((r) => ({ id: r.id, name: r.name, programId: r.program_id })),
        ),
      )
      .catch(() => {});
  }, []);

  const selectedProgramId = useMemo(
    () => programOptions.find((p) => p.code === program)?.id,
    [program, programOptions],
  );

  const trainingOptions = useMemo(
    () =>
      selectedProgramId
        ? allTrainings
            .filter((option) => option.programId === selectedProgramId)
            .map((option) => option.name)
        : allTrainings.map((option) => option.name),
    [selectedProgramId, allTrainings],
  );

  const handleProgramChange = (value: string | null) => {
    setProgram(value);
    setTraining("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialty.trim()) return;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      fullName,
      specialty: specialty.trim(),
      program: (program as Teacher["program"]) ?? undefined,
      training: training || undefined,
      phone,
      email,
      jobTitle: jobTitle.trim() || undefined,
      company: company.trim() || undefined,
      location: location.trim() || undefined,
      education: education.trim() || undefined,
      // New teachers get the operator-chosen login password; edits leave
      // login data untouched (TeachersPage merge-preserves it).
      ...(initialData
        ? {}
        : {
            password: password.trim() || DEFAULT_TEACHER_PASSWORD,
          }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("Full Name")}</Label>
        <Input
          id="fullName"
          placeholder={t("Enter full name")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialty">{t("Specialty")}</Label>
        <Input
          id="specialty"
          placeholder={t("Enter specialty (e.g. Cybersecurity & Networking)")}
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("Program")}</Label>
          <Select value={program} onValueChange={handleProgramChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("Select program")} />
            </SelectTrigger>
            <SelectContent>
              {programOptions.map((p) => (
                <SelectItem key={p.id} value={p.code}>
                  {p.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("Training")}</Label>
          <Select
            value={training}
            onValueChange={(value) => setTraining(value ?? "")}
            disabled={trainingOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  trainingOptions.length === 0
                    ? t("No trainings yet")
                    : t("Select training")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {trainingOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{t("Phone Number")}</Label>
        <Input
          id="phone"
          placeholder={t("Enter phone number")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("Email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("Enter email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="jobTitle">{t("Job Title")}</Label>
          <Input
            id="jobTitle"
            placeholder={t("Job title")}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">{t("Company")}</Label>
          <Input
            id="company"
            placeholder={t("Company")}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">{t("Location")}</Label>
          <Input
            id="location"
            placeholder={t("City or address")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="education">{t("Education")}</Label>
          <Input
            id="education"
            placeholder={t("Highest qualification")}
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />
        </div>
      </div>

      {!initialData && (
        <div className="space-y-2">
          <Label htmlFor="password">{t("Password")}</Label>
          <Input
            id="password"
            placeholder={t("Enter password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("Teachers log in with their full name and this password.")}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!specialty.trim()}
          className="bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {initialData ? t("Update Teacher") : t("Add Teacher")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
