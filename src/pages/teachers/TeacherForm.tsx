import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Teacher {
  id: string;
  fullName: string;
  subject: string;
  phone: string;
  email: string;
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
  const [subject, setSubject] = useState(initialData?.subject ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      fullName,
      subject,
      phone,
      email,
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
        <Label htmlFor="subject">Subject / Specialty</Label>
        <Input
          id="subject"
          placeholder="Enter subject or specialty"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
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

      <div className="flex gap-2">
        <Button type="submit">
          {initialData ? "Update Teacher" : "Add Teacher"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
