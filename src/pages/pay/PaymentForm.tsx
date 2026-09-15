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
  amount: number;
  planType: "one_time" | "semester" | "monthly";
  paymentDate: string;
  status?: string;
  createdAt?: string;
}

interface PaymentFormProps {
  students: Student[];
  onSave: (payment: Payment) => void;
  onCancel?: () => void;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function PaymentForm({ students, onSave, onCancel }: PaymentFormProps) {
  const [nameInput, setNameInput] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState("");
  const [planType, setPlanType] = useState<Payment["planType"]>("one_time");
  const [status, setStatus] = useState("paid");
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
      amount: parseFloat(amount),
      planType,
      paymentDate: date,
      status,
    });
    setAmount("");
    setNameInput("");
    setSelectedStudent(null);
    setPlanType("one_time");
    setStatus("paid");
    setDate(todayString());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
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
              <SelectItem value="one_time">One-Time</SelectItem>
              <SelectItem value="semester">Semester</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Payment Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!selectedStudent || !amount}>
          Add Payment
        </Button>
      </div>
    </form>
  );
}
