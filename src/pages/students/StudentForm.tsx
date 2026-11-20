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
import { DEFAULT_STUDENT_PASSWORD } from "@/pages/users/userAccounts";
import { EDUCATION_OPTIONS, ENGAGEMENT_OPTIONS } from "./studentOptions";

export interface Student {
  id: string;
  fullName: string;
  program: "BTP" | "BTS" | "CAP";
  training: string;
  programId?: string;
  trainingId?: string;
  phone: string;
  email: string;
  location?: string;
  education?: string;
  age?: number;
  engagement?: string;
  // Optional social profile links, edited by the student in the student portal's
  // Settings page. All nullable; an empty field is stored as SQL NULL.
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
  github?: string;
  linkedin?: string;
  password?: string;
  blocked?: boolean;
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

// Creates a student. Editing an existing record lives in the profile's edit
// sheet (`EditStudentSheet`), so this form has no initial-data/edit mode.
interface StudentFormProps {
  onSave: (student: Student) => void;
  onCancel: () => void;
}

export default function StudentForm({ onSave, onCancel }: StudentFormProps) {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [program, setProgram] = useState<Student["program"] | null>(null);
  const [training, setTraining] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [education, setEducation] = useState("");
  const [age, setAge] = useState("");
  const [engagement, setEngagement] = useState("");

  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<TrainingOption[]>([]);

  useEffect(() => {
    listPrograms().then(setProgramOptions).catch(() => {});
    listTrainings().then((rows) => {
      setAllTrainings(
        rows.map((r) => ({ id: r.id, name: r.name, programId: r.program_id })),
      );
    }).catch(() => {});
  }, []);

  const selectedProgramId = useMemo(
    () => programOptions.find((p) => p.code === program)?.id,
    [program, programOptions],
  );

  const trainingOptions = useMemo(
    () =>
      selectedProgramId
        ? allTrainings.filter((option) => option.programId === selectedProgramId)
        : [],
    [selectedProgramId, allTrainings],
  );

  const handleProgramChange = (value: string | null) => {
    setProgram(value as Student["program"]);
    setTraining("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !training) return;
    const parsedAge = age.trim() === "" ? undefined : Math.round(Number(age));
    onSave({
      id: crypto.randomUUID(),
      fullName,
      program,
      training,
      phone,
      email,
      location: location.trim() || undefined,
      education: education || undefined,
      age: Number.isFinite(parsedAge) ? parsedAge : undefined,
      engagement: engagement || undefined,
      // New students start with the default login password.
      password: DEFAULT_STUDENT_PASSWORD,
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
        <Label>{t("Program")}</Label>
        <Select
          value={program}
          onValueChange={handleProgramChange}
        >
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
          disabled={!program}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("Select training")} />
          </SelectTrigger>
          <SelectContent>
            {trainingOptions.map((option) => (
              <SelectItem key={option.id} value={option.name}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <Label htmlFor="location">{t("Location")}</Label>
          <Input
            id="location"
            placeholder={t("City or address")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">{t("Age")}</Label>
          <Input
            id="age"
            type="number"
            min={1}
            placeholder={t("Age")}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Education")}</Label>
          <Select
            value={education}
            onValueChange={(value) => setEducation(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select education level")} />
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

        <div className="space-y-2">
          <Label>{t("Engagement")}</Label>
          <Select
            value={engagement}
            onValueChange={(value) => setEngagement(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select engagement")} />
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

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!program || !training}
          className="bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {t("Add Student")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
