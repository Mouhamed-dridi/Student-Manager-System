import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  insertPayments,
  listPayments,
  listStudents,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import PaymentForm, { type Payment } from "./PaymentForm";
import PaymentList from "./PaymentList";
import PrintReceipt from "./PrintReceipt";
import PrintTicket from "./PrintTicket";

const PLAN_TYPES: Payment["planType"][] = ["one-time", "semester", "monthly"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinLastMonths(months: number) {
  const ms = months * 30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - Math.random() * ms).toISOString().split("T")[0];
}

export default function PayPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{
    payment: Payment;
    student: Student;
  } | null>(null);
  const [ticketTarget, setTicketTarget] = useState<Payment | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listStudents(), listPayments()])
      .then(([nextStudents, nextPayments]) => {
        setStudents(nextStudents);
        setPayments(nextPayments);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // TODO: temporary prototype helper — remove before production.
  const handleSeedFakeData = async () => {
    if (!students || students.length === 0 || !payments) {
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

    try {
      setError(null);
      await insertPayments(fakePayments);
      setPayments(await listPayments());
      setSeedMessage(`Added ${fakePayments.length} fake payments.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSave = async (payment: Payment) => {
    try {
      setError(null);
      await insertPayments([payment]);
      setPayments(await listPayments());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handlePrintReceipt = (payment: Payment) => {
    if (!students) return;
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
      {error && (
        <div className="mt-2">
          <DataError message={error} />
        </div>
      )}
      {seedMessage && (
        <p className="mt-2 text-sm text-muted-foreground">{seedMessage}</p>
      )}

      <div className="mt-4">
        {students === null || payments === null ? (
          <DataLoading label="Loading payments…" />
        ) : (
          <>
            <PaymentForm students={students} onSave={handleSave} />

            <Separator className="my-6" />

            <PaymentList
              payments={payments}
              onPrintReceipt={handlePrintReceipt}
              onPrintTicket={handlePrintTicket}
            />
          </>
        )}
      </div>

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
