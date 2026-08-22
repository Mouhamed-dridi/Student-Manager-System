import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Student } from "@/pages/students/StudentForm";
import PaymentForm, { type Payment } from "./PaymentForm";
import PaymentList from "./PaymentList";
import PrintReceipt from "./PrintReceipt";
import PrintTicket from "./PrintTicket";

const STUDENTS_KEY = "students";
const PAYMENTS_KEY = "payments";

const PLAN_TYPES: Payment["planType"][] = ["one-time", "semester", "monthly"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinLastMonths(months: number) {
  const ms = months * 30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - Math.random() * ms)
    .toISOString()
    .split("T")[0];
}

function loadStudents(): Student[] {
  try {
    return JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function loadPayments(): Payment[] {
  try {
    const parsed: Payment[] = JSON.parse(
      localStorage.getItem(PAYMENTS_KEY) ?? "[]",
    );
    return parsed.map((p) => ({
      ...p,
      studentProgram: p.studentProgram ?? "",
      studentTraining: p.studentTraining ?? "",
    }));
  } catch {
    return [];
  }
}

function savePayments(payments: Payment[]) {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export default function PayPage() {
  const [students] = useState<Student[]>(loadStudents);
  const [payments, setPayments] = useState<Payment[]>(loadPayments);
  const [receiptTarget, setReceiptTarget] = useState<{
    payment: Payment;
    student: Student;
  } | null>(null);
  const [ticketTarget, setTicketTarget] = useState<Payment | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    savePayments(payments);
  }, [payments]);

  // TODO: temporary prototype helper — remove before production.
  const handleSeedFakeData = () => {
    if (students.length === 0) {
      setSeedMessage("No students saved yet — add students first.");
      return;
    }

    const fakePayments: Payment[] = Array.from({ length: 10 }, () => {
      const student = students[randomInt(0, students.length - 1)];
      return {
        id: crypto.randomUUID(),
        studentId: student.id,
        studentName: student.fullName,
        studentProgram: student.program,
        studentTraining: student.training,
        amount: randomInt(100, 500),
        planType: PLAN_TYPES[randomInt(0, PLAN_TYPES.length - 1)],
        date: randomDateWithinLastMonths(3),
      };
    });

    setPayments((prev) => [...prev, ...fakePayments]);
    setSeedMessage(`Added ${fakePayments.length} fake payments.`);
  };

  const handleSave = (payment: Payment) => {
    setPayments((prev) => [...prev, payment]);
  };

  const handlePrintReceipt = (payment: Payment) => {
    const student = students.find((s) => s.id === payment.studentId);
    if (student) {
      setReceiptTarget({ payment, student });
    }
  };

  const handlePrintTicket = (payment: Payment) => {
    setTicketTarget(payment);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Payments</h2>
        {/* TODO: temporary prototype helper — remove before production. */}
        <Button variant="outline" onClick={handleSeedFakeData}>
          Seed Fake Data
        </Button>
      </div>
      {seedMessage && (
        <p className="mt-2 text-sm text-muted-foreground">{seedMessage}</p>
      )}

      <div className="mt-4">
        <PaymentForm students={students} onSave={handleSave} />
      </div>

      <Separator className="my-6" />

      <PaymentList
        payments={payments}
        onPrintReceipt={handlePrintReceipt}
        onPrintTicket={handlePrintTicket}
      />

      {receiptTarget && (
        <PrintReceipt
          key={receiptTarget.payment.id}
          payment={receiptTarget.payment}
          student={receiptTarget.student}
        />
      )}

      {ticketTarget && (
        <PrintTicket
          key={ticketTarget.id}
          payment={ticketTarget}
        />
      )}
    </div>
  );
}
