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
import type { Student } from "@/pages/students/StudentForm";

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  studentProgram: string;
  studentTraining: string;
  amount: number;
  planType: "one-time" | "semester" | "monthly";
  date: string;
  status?: string;
}

interface PaymentFormProps {
  students: Student[];
  onSave: (payment: Payment) => void;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function PaymentForm({ students, onSave }: PaymentFormProps) {
  const [nameInput, setNameInput] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState("");
  const [planType, setPlanType] = useState<Payment["planType"]>("one-time");
  const [date, setDate] = useState(todayString);

  const query = nameInput.trim().toLowerCase();
  const matches =
    !selectedStudent && query
      ? students.filter((s) => s.fullName.toLowerCase().includes(query))
      : [];

  const handleNameChange = (value: string) => {
    setNameInput(value);
    if (
      selectedStudent &&
      value.toLowerCase() !== selectedStudent.fullName.toLowerCase()
    ) {
      setSelectedStudent(null);
    }
  };

  const handlePickStudent = (student: Student) => {
    setSelectedStudent(student);
    setNameInput(student.fullName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    onSave({
      id: crypto.randomUUID(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.fullName,
      studentProgram: selectedStudent.program,
      studentTraining: selectedStudent.training,
      amount: parseFloat(amount),
      planType,
      date,
    });
    setAmount("");
    setNameInput("");
    setSelectedStudent(null);
    setPlanType("one-time");
    setDate(todayString());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentName">Student</Label>
        <div className="relative">
          <Input
            id="studentName"
            placeholder="Type a student name..."
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover py-1 shadow-md">
              {matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePickStudent(s)}
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  {s.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
        {!selectedStudent && query && matches.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No students match "{nameInput.trim()}".
          </p>
        )}

        {selectedStudent && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label>Program</Label>
              <p className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm">
                {selectedStudent.program}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Training</Label>
              <p className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm">
                {selectedStudent.training || "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Plan Type</Label>
        <Select
          value={planType}
          onValueChange={(v) => setPlanType(v as Payment["planType"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one-time">One-time</SelectItem>
            <SelectItem value="semester">Semester</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <Button type="submit" disabled={!selectedStudent}>
        Add Payment
      </Button>
    </form>
  );
}
