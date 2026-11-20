import * as XLSX from "xlsx";
import { t } from "@/lib/i18n";
import {
  formatPaymentMethod,
  paymentDateLabel,
  paymentPeriodLabel,
  planTypeLabel,
  type Payment,
} from "./paymentTypes";

/** Exports the given payments as a spreadsheet, with localized headers. */
export function exportPayments(payments: Payment[], currency: string): void {
  if (payments.length === 0) return;

  const rows = payments.map((payment) => [
    payment.studentName,
    paymentDateLabel(payment.paymentDate),
    payment.studentProgram || payment.program || "",
    planTypeLabel(payment.planType),
    paymentPeriodLabel(payment),
    formatPaymentMethod(payment.paymentMethod),
    payment.amount,
    currency,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      t("Student"),
      t("Date"),
      t("Branch / Program"),
      t("Plan Type"),
      t("Period"),
      t("Payment Method"),
      t("Amount"),
      t("Currency"),
    ],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payments");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `payments-${date}.xlsx`);
}
