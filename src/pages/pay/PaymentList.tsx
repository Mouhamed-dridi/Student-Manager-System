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

/** Program pills: one hue per track so rows are scannable at a glance. */
const PROGRAM_BADGES: Record<string, string> = {
  BTP: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BTS:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  CAP:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

function ProgramBadge({ program }: { program?: string }) {
  if (!program) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone =
    PROGRAM_BADGES[program] ??
    "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${tone}`}
    >
      {program}
    </span>
  );
}

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
        (p.program ?? "").toLowerCase().includes(q),
    );
  }, [payments, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student, date, or program..."
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
              <TableHead>Student</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Plan Type</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.studentName || "—"}</TableCell>
                <TableCell>
                  <ProgramBadge program={p.program} />
                </TableCell>
                <TableCell>{p.amount.toFixed(2)}</TableCell>
                <TableCell>{PLAN_LABELS[p.planType]}</TableCell>
                <TableCell>{formatDate(p.paymentDate)}</TableCell>
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