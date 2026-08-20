import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import type { Student } from "@/pages/students/StudentForm";
import PaymentForm, { type Payment } from "./PaymentForm";
import PaymentList from "./PaymentList";
import PrintReceipt from "./PrintReceipt";
import PrintTicket from "./PrintTicket";

const STUDENTS_KEY = "students";
const PAYMENTS_KEY = "payments";

function loadStudents(): Student[] {
  try {
    return JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function loadPayments(): Payment[] {
  try {
    return JSON.parse(localStorage.getItem(PAYMENTS_KEY) ?? "[]");
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

  useEffect(() => {
    savePayments(payments);
  }, [payments]);

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
      <h2 className="text-2xl font-semibold">Payments</h2>

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
