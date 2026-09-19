import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  listDeletedPayments,
  listStudents,
  paymentsSupportsTrash,
  restorePayment,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { Payment } from "./PaymentForm";

const PLAN_LABELS: Record<Payment["planType"], string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function PaymentTrashPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [trashAvailable, setTrashAvailable] = useState(true);

  const load = () =>
    Promise.all([
      listStudents(),
      listDeletedPayments(),
      paymentsSupportsTrash(),
    ]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(([nextStudents, nextPayments, trashAvailable]) => {
        if (!cancelled) {
          setStudents(nextStudents);
          setPayments(nextPayments);
          setTrashAvailable(trashAvailable);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deletedWithNames = useMemo(() => {
    if (!students || !payments) return payments;
    return payments.map((p) => ({
      ...p,
      studentName:
        students.find((s) => s.id === p.studentId)?.fullName ?? p.studentName,
    }));
  }, [students, payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deletedWithNames ?? [];
    return (deletedWithNames ?? []).filter((p) =>
      p.studentName.toLowerCase().includes(q),
    );
  }, [deletedWithNames, search]);

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      setSaving(true);
      setError(null);
      await restorePayment(restoreTarget);
      const [nextStudents, nextPayments, trashAvailable] = await load();
      setStudents(nextStudents);
      setPayments(nextPayments);
      setTrashAvailable(trashAvailable);
      setRestoreTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Payment Trash</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Deleted payments are kept here for auditing. Restore to move a payment
        back to the active list.
      </p>

      <div className="mt-4">
        {error && <DataError message={error} />}
      </div>

      <div className="mt-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {students === null || payments === null ? (
          !error && <DataLoading label="Loading trash…" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {payments.length === 0
              ? trashAvailable
                ? "The trash is empty."
                : "Trash is not available on this database — the payments table has no is_deleted/deleted_at columns, so deletions are only tracked for the current session."
              : "No payments match your search."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Plan Type</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deleted At</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.studentName || "—"}</TableCell>
                  <TableCell>{p.amount.toFixed(2)}</TableCell>
                  <TableCell>{PLAN_LABELS[p.planType]}</TableCell>
                  <TableCell>{formatDate(p.paymentDate)}</TableCell>
                  <TableCell>{p.status ?? "—"}</TableCell>
                  <TableCell>
                    {p.deletedAt ? formatDate(p.deletedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Restore payment"
                      aria-label={`Restore payment for ${p.studentName}`}
                      onClick={() => setRestoreTarget(p)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore payment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{restoreTarget?.studentName}” —{" "}
              {restoreTarget ? restoreTarget.amount.toFixed(2) : ""} — will move
              back to the active Payments list. The restore is recorded in the
              history log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={saving}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}