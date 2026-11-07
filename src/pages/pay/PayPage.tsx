import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  getSystemName,
  insertPayments,
  listPayments,
  listStudents,
  softDeletePayment,
  updatePayment,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import AddPaymentModal from "./AddPaymentModal";
import PaymentsView from "./PaymentsView";
import PaymentReceiptModal from "./PaymentReceiptModal";
import { studentProgramSnapshot, type Payment } from "./paymentTypes";

export default function PayPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [centerName, setCenterName] = useState("SSM");
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listStudents(), listPayments(), getSystemName()])
      .then(([nextStudents, nextPayments, nextName]) => {
        setStudents(nextStudents);
        setPayments(nextPayments);
        setCenterName(nextName);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const paymentsWithNames = useMemo(() => {
    if (!students || !payments) return payments;
    return payments.map((p) => {
      const student = students.find((s) => s.id === p.studentId);
      return {
        ...p,
        studentName: student?.fullName ?? p.studentName,
        program: student?.program ?? p.program,
        // Legacy rows predate student_program: fall back to the current record.
        studentProgram:
          p.studentProgram ??
          (student ? studentProgramSnapshot(student) : undefined),
      };
    });
  }, [students, payments]);

  const handleAdd = async (payment: Payment) => {
    try {
      setSaving(true);
      setError(null);
      await insertPayments([payment]);
      setPayments(await listPayments());
      setAddDialogOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (updated: Payment) => {
    if (!editing) return;
    try {
      setSaving(true);
      setError(null);
      await updatePayment(editing, updated);
      setPayments(await listPayments());
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      setError(null);
      await softDeletePayment(deleteTarget);
      setPayments(await listPayments());
      setDeleteTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Payments</h2>
        <Button
          onClick={() => {
            setError(null);
            setAddDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Payment
        </Button>
      </div>

      <div className="mt-4">
        {error && !addDialogOpen && !editing && <DataError message={error} />}

        {students === null || payments === null ? (
          <DataLoading label="Loading payments…" />
        ) : (
          <PaymentsView
            payments={paymentsWithNames ?? []}
            onEdit={(payment) => {
              setError(null);
              setEditing(payment);
            }}
            onDelete={setDeleteTarget}
            onPrint={setReceiptTarget}
          />
        )}
      </div>

      {students && addDialogOpen && (
        <AddPaymentModal
          open
          students={students}
          error={error}
          onSave={handleAdd}
          onClose={() => setAddDialogOpen(false)}
        />
      )}

      {students && editing && (
        <AddPaymentModal
          key={editing.id}
          open
          students={students}
          initial={editing}
          error={error}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move payment to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.studentName}” —{" "}
              {deleteTarget ? deleteTarget.amount.toFixed(2) : ""} — will be
              moved to Pay › Trash. It stays safely stored there and can be
              restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {students && receiptTarget && (
        <PaymentReceiptModal
          payment={receiptTarget}
          student={
            students.find((s) => s.id === receiptTarget.studentId) ?? undefined
          }
          centerName={centerName}
          open={receiptTarget !== null}
          onClose={() => setReceiptTarget(null)}
        />
      )}
    </div>
  );
}