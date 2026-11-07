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
import {
  PLAN_LABELS,
  formatPaymentMethod,
  paymentPeriodLabel,
  type Payment,
} from "./paymentTypes";

interface PaymentsViewProps {
  payments: Payment[];
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onPrint: (payment: Payment) => void;
}

/** One hue per track so the specialty column is scannable at a glance. */
const PROGRAM_BADGES: Record<string, string> = {
  BTP: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  BTS: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  CAP: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const METHOD_BADGES: Record<string, string> = {
  check: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "Espèce":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Virement:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${tone}`}
    >
      {children}
    </span>
  );
}

function SpecialtyBadge({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const code = value.split(/[\s-]+/)[0]?.toUpperCase() ?? "";
  const tone =
    PROGRAM_BADGES[code] ?? "border-border bg-muted text-muted-foreground";
  return <Badge tone={tone}>{value}</Badge>;
}

/** payment_date is a plain YYYY-MM-DD string; render it as DD/MM/YYYY. */
function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function PaymentsView({
  payments,
  onEdit,
  onDelete,
  onPrint,
}: PaymentsViewProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) =>
      [
        payment.studentName,
        payment.studentProgram,
        payment.program,
        payment.paymentDate,
        payment.paymentMethod,
        payment.semester,
        payment.paymentMonth,
      ].some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [payments, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student, program, method, period..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
              <TableHead>Student Name</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Specialty / Program</TableHead>
              <TableHead>Plan Type</TableHead>
              <TableHead>Semester / Month</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((payment) => {
              const method = payment.paymentMethod ?? "";
              return (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {payment.studentName || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(payment.paymentDate)}
                  </TableCell>
                  <TableCell>
                    <SpecialtyBadge
                      value={payment.studentProgram || payment.program}
                    />
                  </TableCell>
                  <TableCell>{PLAN_LABELS[payment.planType]}</TableCell>
                  <TableCell>{paymentPeriodLabel(payment)}</TableCell>
                  <TableCell>
                    {method ? (
                      <Badge
                        tone={
                          METHOD_BADGES[method] ??
                          "border-border bg-muted text-muted-foreground"
                        }
                      >
                        {formatPaymentMethod(method)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {payment.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Print receipt"
                        aria-label={`Print receipt for ${payment.studentName}`}
                        onClick={() => onPrint(payment)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit payment"
                        aria-label={`Edit payment for ${payment.studentName}`}
                        onClick={() => onEdit(payment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Move to trash"
                        aria-label={`Delete payment for ${payment.studentName}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(payment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
