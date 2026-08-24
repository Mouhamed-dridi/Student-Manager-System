import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listPayments } from "@/lib/api";
import type { Payment } from "@/pages/pay/PaymentForm";

const PLAN_LABELS: Record<Payment["planType"], string> = {
  "one-time": "One-time",
  semester: "Semester",
  monthly: "Monthly",
};

export default function MyPaymentsPage() {
  // No session id means there is nothing to load — start with an empty list.
  const [payments, setPayments] = useState<Payment[] | null>(() =>
    localStorage.getItem("currentStudentId") ? null : [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("currentStudentId");
    if (!id) return;
    listPayments()
      .then((all) =>
        setPayments(
          all
            .filter((p) => p.studentId === id)
            .sort((a, b) => b.date.localeCompare(a.date)),
        ),
      )
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const total = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">My Payment</h2>
        <span className="text-sm text-muted-foreground">
          Total paid: {total}
        </span>
      </div>

      <div className="mt-4">
        {error && (
          <DataError message={error} />
        )}
      </div>

      {payments === null ? (
        !error && <DataLoading label="Loading payments…" />
      ) : payments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No payments recorded yet.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Plan Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.date}</TableCell>
                <TableCell>{p.amount}</TableCell>
                <TableCell>{PLAN_LABELS[p.planType]}</TableCell>
                <TableCell>{p.status ?? "Completed"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
