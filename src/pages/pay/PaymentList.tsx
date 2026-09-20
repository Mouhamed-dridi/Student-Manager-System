import { useMemo, useState } from "react";
import { Pencil, Printer, Search, Trash2 } from "lucide-react";
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
import type { Payment } from "./PaymentForm";

interface PaymentListProps {
  payments: Payment[];
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onPrint: (payment: Payment) => void;
}

const PLAN_LABELS: Record<Payment["planType"], string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function PaymentList({
  payments,
  onEdit,
  onDelete,
  onPrint,
}: PaymentListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.studentName.toLowerCase().includes(q) ||
        p.paymentDate.includes(q) ||
        (p.status ?? "").toLowerCase().includes(q),
    );
  }, [payments, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student, date, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {payments.length === 0
            ? "No payments recorded yet."
            : "No payments match your search."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Plan Type</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.id.slice(0, 8)}
                </TableCell>
                <TableCell>{p.studentName || "—"}</TableCell>
                <TableCell>{p.amount.toFixed(2)}</TableCell>
                <TableCell>{PLAN_LABELS[p.planType]}</TableCell>
                <TableCell>{formatDate(p.paymentDate)}</TableCell>
                <TableCell>{p.status ?? "—"}</TableCell>
                <TableCell>
                  {p.createdAt ? formatDate(p.createdAt) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Print receipt"
                      aria-label={`Print receipt for ${p.studentName}`}
                      onClick={() => onPrint(p)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit payment"
                      aria-label={`Edit payment for ${p.studentName}`}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Move to trash"
                      aria-label={`Delete payment for ${p.studentName}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}