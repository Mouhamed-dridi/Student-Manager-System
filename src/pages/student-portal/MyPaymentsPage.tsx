import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Payment } from "@/pages/pay/PaymentForm";

const PLAN_LABELS: Record<Payment["planType"], string> = {
  "one-time": "One-time",
  semester: "Semester",
  monthly: "Monthly",
};

function loadPayments(): Payment[] {
  try {
    const id = localStorage.getItem("currentStudentId");
    if (!id) return [];
    const payments: Payment[] = JSON.parse(
      localStorage.getItem("payments") ?? "[]",
    );
    return payments
      .filter((p) => p.studentId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export default function MyPaymentsPage() {
  const [payments] = useState<Payment[]>(loadPayments);

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">My Payment</h2>
        <span className="text-sm text-muted-foreground">
          Total paid: {total}
        </span>
      </div>

      {payments.length === 0 ? (
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
