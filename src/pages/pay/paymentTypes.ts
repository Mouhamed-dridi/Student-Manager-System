import { t } from "@/lib/i18n";
import type { Student } from "@/pages/students/StudentForm";

/** How the money reached the center. Stored verbatim in payments.payment_method. */
export type PaymentMethod = "check" | "Espèce" | "Virement";

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  /** Display-only: resolved from the student record by the list pages. */
  program?: Student["program"];
  /**
   * Snapshot of the student's program/specialty at the time of payment, e.g.
   * "BTP - Web Development". Stored in payments.student_program.
   */
  studentProgram?: string;
  amount: number;
  planType: "one_time" | "semester" | "monthly";
  /** payments.payment_method */
  paymentMethod?: PaymentMethod;
  /** "Semester 1" | "Semester 2" when planType is "semester". */
  semester?: string;
  /** Full month name (January…December) when planType is "monthly". */
  paymentMonth?: string;
  paymentDate: string;
  status?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
}

/**
 * Stored values stay untouched ("check", "Espèce", "Virement" — legacy rows
 * included); only the visible label follows the active language.
 */
export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "check", label: "Check" },
  { value: "Espèce", label: "Cash" },
  { value: "Virement", label: "Transfer" },
];

export const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"] as const;

export const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const PLAN_TYPE_OPTIONS: {
  value: Payment["planType"];
  label: string;
}[] = [
  { value: "monthly", label: "Monthly" },
  { value: "semester", label: "Semester" },
  { value: "one_time", label: "One-Time" },
];

/** English labels for exports and non-React callers. */
export const PLAN_LABELS: Record<Payment["planType"], string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

/** Currency unit fallback; mirrors the Settings page default. */
export const DEFAULT_CURRENCY = "TND";

/** Program + training as one snapshot string, e.g. "BTP - Web Development". */
export function studentProgramSnapshot(student: Student): string {
  return [student.program, student.training].filter(Boolean).join(" - ");
}

/** Localized plan label ("Mensuel", "Semestriel", "Paiement unique"). */
export function planTypeLabel(planType: Payment["planType"]): string {
  return t(PLAN_LABELS[planType] ?? planType);
}

/** Normalizes the stored method (and its legacy spellings) to one category. */
export function paymentMethodCategory(
  value?: string,
): "cash" | "check" | "transfer" | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["cash", "espèce", "espece", "espèces", "especes"].includes(normalized))
    return "cash";
  if (["check", "chèque", "cheque"].includes(normalized)) return "check";
  if (["transfer", "virement", "virement bancaire"].includes(normalized))
    return "transfer";
  return null;
}

const METHOD_LABEL_KEYS = {
  cash: "Cash",
  check: "Check",
  transfer: "Transfer",
} as const;

/** Readable, localized label for a stored payment_method value. */
export function formatPaymentMethod(value?: string): string {
  if (!value) return "—";
  const category = paymentMethodCategory(value);
  return category ? t(METHOD_LABEL_KEYS[category]) : value;
}

/** Semester/month snapshots are stored in English; show them in the UI language. */
function periodValueLabel(value?: string): string {
  if (!value) return "—";
  if (
    (SEMESTER_OPTIONS as readonly string[]).includes(value) ||
    (MONTH_OPTIONS as readonly string[]).includes(value)
  ) {
    return t(value);
  }
  return value;
}

/** What the Period column (and receipt) should read for a payment. */
export function paymentPeriodLabel(payment: Payment): string {
  if (payment.planType === "semester") return periodValueLabel(payment.semester);
  if (payment.planType === "monthly")
    return periodValueLabel(payment.paymentMonth);
  return "—";
}

/** payment_date is a plain YYYY-MM-DD string; render it as DD/MM/YYYY. */
export function paymentDateLabel(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** `1,200.00 DT` — thousands separators plus the center's currency unit. */
export function formatMoney(amount: number, currency?: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  const unit = (currency ?? "").trim() || DEFAULT_CURRENCY;
  return `${formatted} ${unit}`;
}
