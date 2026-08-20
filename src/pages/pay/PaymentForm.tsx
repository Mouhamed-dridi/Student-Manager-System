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
  planType: "one-time" | "semester" | "monthly";
  date: string;
}

interface PaymentFormProps {
  students: Student[];
  onSave: (payment: Payment) => void;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function PaymentForm({ students, onSave }: PaymentFormProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [planType, setPlanType] = useState<Payment["planType"]>("one-time");
  const [date, setDate] = useState(todayString);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;
    onSave({
      id: crypto.randomUUID(),
      studentId: student.id,
      studentName: student.fullName,
      amount: parseFloat(amount),
      planType,
      date,
    });
    setAmount("");
    setSelectedStudentId("");
    setPlanType("one-time");
    setDate(todayString());
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label>Student</Label>
        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <Button type="submit">Add Payment</Button>
    </form>
  );
}
