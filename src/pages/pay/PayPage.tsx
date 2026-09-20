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
import PaymentForm, { type Payment } from "./PaymentForm";
import PaymentList from "./PaymentList";
import PaymentReceiptModal from "./PaymentReceiptModal";

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
    return payments.map((p) => ({
      ...p,
      studentName:
        students.find((s) => s.id === p.studentId)?.fullName ?? p.studentName,
    }));
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
        <Button onClick={() => setAddDialogOpen(true)}>
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
            onEdit={setEditing}
            onDelete={setDeleteTarget}
            onPrint={setReceiptTarget}
          />
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={(open) => setAddDialogOpen(open)}>
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
              onSave={handleAdd}
              onCancel={() => setAddDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Modify this payment's details. The change is recorded in the
              history log.
            </DialogDescription>
          </DialogHeader>
          {students && editing && (
            <PaymentForm
              key={editing.id}
              students={students}
              initial={editing}
              onSave={handleEdit}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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