import { useState } from "react";
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

export interface Student {
  id: string;
  fullName: string;
  program: "BTP" | "BTS" | "CAP";
  phone: string;
  email: string;
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
  const [program, setProgram] = useState<Student["program"]>(
    initialData?.program ?? "BTP"
  );
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      fullName,
      program,
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
        <Label>Program</Label>
        <Select
          value={program}
          onValueChange={(v) => setProgram(v as Student["program"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BTP">BTP</SelectItem>
            <SelectItem value="BTS">BTS</SelectItem>
            <SelectItem value="CAP">CAP</SelectItem>
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

      <div className="flex gap-2">
        <Button type="submit">
          {initialData ? "Update Student" : "Add Student"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
