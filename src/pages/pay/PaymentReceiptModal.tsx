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
import {
  PLAN_LABELS,
  DEFAULT_CURRENCY,
  formatMoney,
  formatPaymentMethod,
  paymentPeriodLabel,
  type Payment,
} from "./paymentTypes";
import type { Student } from "@/pages/students/StudentForm";
import { useT } from "@/lib/i18n";

interface PaymentReceiptModalProps {
  payment: Payment;
  student?: Student;
  centerName: string;
  currency?: string;
  open: boolean;
  onClose: () => void;
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
  currency = DEFAULT_CURRENCY,
  open,
  onClose,
}: PaymentReceiptModalProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("receipt-printing");
    return () => document.body.classList.remove("receipt-printing");
  }, [open]);

  const className = [student?.program, student?.training]
    .filter(Boolean)
    .join(" - ") || payment.studentProgram || "—";
  const status = (payment.status ?? "paid").toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("Payment Receipt")}</DialogTitle>
          <DialogDescription>
            {t("Preview and print a receipt ticket for this payment.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            title={t("Print receipt")}
            aria-label={t("Print receipt")}
            className="receipt-no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("Optimized for 80mm receipt paper")}
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
              {t("Payment Receipt")}
            </p>
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-3">
            <DashedRow label={t("Student")} value={payment.studentName || "—"} />
            <DashedRow label={t("Branch")} value={className || "—"} />
            <DashedRow
              label={t("Plan")}
              value={t(PLAN_LABELS[payment.planType] ?? payment.planType)}
            />
            {payment.planType !== "one_time" && (
              <DashedRow
                label={t("Period")}
                value={paymentPeriodLabel(payment)}
              />
            )}
            {payment.paymentMethod && (
              <DashedRow
                label={t("Method")}
                value={formatPaymentMethod(payment.paymentMethod)}
              />
            )}
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="uppercase text-[11px] tracking-wide text-neutral-500">
                {t("Amount")}
              </span>
              <span className="text-xl font-extrabold tabular-nums">
                {formatMoney(payment.amount, currency)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="uppercase text-[11px] tracking-wide text-neutral-500">
                {t("Status")}
              </span>
              <span
                className={
                  status === "paid"
                    ? "rounded-full border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white uppercase"
                    : "rounded-full border border-neutral-400 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700 uppercase"
                }
              >
                {status === "paid" ? t("Paid") : t("Pending")}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-dashed border-neutral-300 pt-3">
            <p className="font-mono text-[10px] break-all text-neutral-500">
              REF {payment.id}
            </p>
            <p className="text-[11px]">
              {t("Date")}:{" "}
              {payment.paymentDate
                ? new Date(payment.paymentDate).toLocaleDateString()
                : "—"}
            </p>
            <p className="text-[11px]">
              {t("Recorded at")}: {formatDateTime(payment.createdAt)}
            </p>
            <p className="text-[11px]">
              {t("Issued at")}: {new Date().toLocaleString()}
            </p>
          </div>

          <div className="border-t border-dashed border-neutral-300 pt-2 text-center">
            <p className="text-[10px] tracking-widest text-neutral-500 uppercase">
              {t("Thank you")}
            </p>
          </div>
        </div>

        <div className="receipt-no-print flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            {t("Close")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t("Print receipt")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
