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
import { DEFAULT_STUDENT_PASSWORD } from "@/pages/users/userAccounts";

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

const EDUCATION_OPTIONS = [
  "Bac",
  "Master",
  "Licence",
  "Engineer",
  "1an",
  "2an",
  "9anne",
];

const ENGAGEMENT_OPTIONS = ["New Student", "Second Year"];

interface ProgramOption {
  id: string;
  code: string;
}

interface TrainingOption {
  id: string;
  name: string;
  programId: string;
}

interface StudentFormProps {
  initialData?: Student;
  onSave: (student: Student) => void;
  onCancel: () => void;
}

export default function StudentForm({
  initialData,
  onSave,
  onCancel,
}: StudentFormProps) {
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [program, setProgram] = useState<Student["program"] | null>(
    initialData?.program ?? null,
  );
  const [training, setTraining] = useState(initialData?.training ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [education, setEducation] = useState(initialData?.education ?? "");
  const [age, setAge] = useState(
    initialData?.age ? String(initialData.age) : "",
  );
  const [engagement, setEngagement] = useState(initialData?.engagement ?? "");

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
        ? allTrainings.filter((t) => t.programId === selectedProgramId)
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
      id: initialData?.id ?? crypto.randomUUID(),
      fullName,
      program,
      training,
      phone,
      email,
      location: location.trim() || undefined,
      education: education || undefined,
      age: Number.isFinite(parsedAge) ? parsedAge : undefined,
      engagement: engagement || undefined,
      // New students start with the default password; edits leave login
      // data untouched (StudentsPage merge-preserves it).
      ...(initialData ? { password: DEFAULT_STUDENT_PASSWORD } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          placeholder="Enter full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Program</Label>
        <Select
          value={program}
          onValueChange={handleProgramChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select program" />
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
        <Label>Training</Label>
        <Select
          value={training}
          onValueChange={(value) => setTraining(value ?? "")}
          disabled={!program}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select training" />
          </SelectTrigger>
          <SelectContent>
            {trainingOptions.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="City or address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={1}
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Education</Label>
          <Select
            value={education}
            onValueChange={(value) => setEducation(value ?? "")}
          >
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label>Engagement</Label>
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
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!program || !training}>
          {initialData ? "Update Student" : "Add Student"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
