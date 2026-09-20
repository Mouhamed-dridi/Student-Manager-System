import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_TEACHER_PASSWORD } from "@/pages/users/userAccounts";

export interface Teacher {
  id: string;
  fullName: string;
  specialty: string;
  phone: string;
  email: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  education?: string;
  password?: string;
  blocked?: boolean;
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
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [specialty, setSpecialty] = useState(initialData?.specialty ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [jobTitle, setJobTitle] = useState(initialData?.jobTitle ?? "");
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [education, setEducation] = useState(initialData?.education ?? "");
  const [password, setPassword] = useState(
    initialData?.password ?? DEFAULT_TEACHER_PASSWORD,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialty.trim()) return;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      fullName,
      specialty: specialty.trim(),
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
        <Label htmlFor="specialty">Specialty</Label>
        <Input
          id="specialty"
          placeholder="Enter specialty (e.g. Cybersecurity & Networking)"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          required
        />
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
          <Label htmlFor="jobTitle">Job Title</Label>
          <Input
            id="jobTitle"
            placeholder="Job title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

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
          <Label htmlFor="education">Education</Label>
          <Input
            id="education"
            placeholder="Highest qualification"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />
        </div>
      </div>

      {!initialData && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Teachers log in with their full name and this password.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!specialty.trim()}>
          {initialData ? "Update Teacher" : "Add Teacher"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
