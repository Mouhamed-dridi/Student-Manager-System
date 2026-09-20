import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Payment } from "./PaymentForm";
import type { Student } from "@/pages/students/StudentForm";

interface PaymentReceiptModalProps {
  payment: Payment;
  student?: Student;
  centerName: string;
  open: boolean;
  onClose: () => void;
}

const PLAN_LABELS: Record<Payment["planType"], string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

function DashedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="uppercase text-[11px] tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-right font-semibold break-words">{value}</span>
    </div>
  );
}

export default function PaymentReceiptModal({
  payment,
  student,
  centerName,
  open,
  onClose,
}: PaymentReceiptModalProps) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("receipt-printing");
    return () => document.body.classList.remove("receipt-printing");
  }, [open]);

  const className = [student?.program, student?.training]
    .filter(Boolean)
    .join(" - ");
  const status = payment.status ?? "pending";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            Preview and print a receipt ticket for this payment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            title="Print receipt"
            aria-label="Print receipt"
            className="receipt-no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Optimized for 80mm receipt paper
          </span>
        </div>

        <div
          id="receipt-print-area"
          className="mx-auto w-[300px] max-w-full space-y-3 bg-white p-5 text-neutral-900 shadow-sm"
          style={{ fontFamily: "'Geist Variable', sans-serif" }}
        >
          <div className="text-center">
            <p className="text-base font-bold uppercase tracking-[0.15em]">
              {centerName}
            </p>
            <p className="mt-1 text-[11px] tracking-widest text-neutral-500 uppercase">
              Payment Receipt
            </p>
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-3">
            <DashedRow label="Student" value={payment.studentName || "—"} />
            <DashedRow label="Class" value={className || "—"} />
            <DashedRow label="Plan" value={PLAN_LABELS[payment.planType]} />
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="uppercase text-[11px] tracking-wide text-neutral-500">
                Amount
              </span>
              <span className="text-xl font-extrabold">
                {formatAmount(payment.amount)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="uppercase text-[11px] tracking-wide text-neutral-500">
                Status
              </span>
              <span
                className={
                  status === "paid"
                    ? "rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase"
                    : "rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-xs font-semibold text-amber-700 uppercase"
                }
              >
                {status === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-dashed border-neutral-300 pt-3">
            <p className="font-mono text-[10px] break-all text-neutral-500">
              REF {payment.id}
            </p>
            <p className="text-[11px]">
              Date:{" "}
              {payment.paymentDate
                ? new Date(payment.paymentDate).toLocaleDateString()
                : "—"}
            </p>
            <p className="text-[11px]">
              Recorded at: {formatDateTime(payment.createdAt)}
            </p>
            <p className="text-[11px]">
              Issued at: {new Date().toLocaleString()}
            </p>
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-2 text-center">
            <p className="text-[10px] tracking-widest text-neutral-500 uppercase">
              Thank you
            </p>
          </div>
        </div>

        <div className="receipt-no-print flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}