import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function PayPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<{
    payment: Payment;
    student: Student;
  } | null>(null);
  const [ticketTarget, setTicketTarget] = useState<Payment | null>(null);

  useEffect(() => {
    Promise.all([listStudents(), listPayments()])
      .then(([nextStudents, nextPayments]) => {
        setStudents(nextStudents);
        setPayments(nextPayments);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const paymentsWithNames = useMemo(() => {
    if (!students || !payments) return payments;
    return payments.map((p) => ({
      ...p,
      studentName:
        students.find((s) => s.id === p.studentId)?.fullName ?? p.studentName,
    }));
  }, [students, payments]);

  const handleSave = async (payment: Payment) => {
    try {
      setError(null);
      await insertPayments([payment]);
      setPayments(await listPayments());
      setDialogOpen(false);
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
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Payment
        </Button>
      </div>

      <div className="mt-4">
        {error && <DataError message={error} />}

        {students === null || payments === null ? (
          <DataLoading label="Loading payments…" />
        ) : (
          <PaymentList
            payments={paymentsWithNames ?? []}
            onPrintReceipt={handlePrintReceipt}
            onPrintTicket={handlePrintTicket}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Record a new payment against a student.
            </DialogDescription>
          </DialogHeader>
          {students && (
            <PaymentForm
              students={students}
              onSave={handleSave}
              onCancel={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {receiptTarget && (
        <PrintReceipt
          key={receiptTarget.payment.id}
          payment={receiptTarget.payment}
          student={receiptTarget.student}
        />
      )}

      {ticketTarget && (
        <PrintTicket key={ticketTarget.id} payment={ticketTarget} />
      )}
    </div>
  );
}