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

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "check", label: "Check" },
  { value: "Espèce", label: "Espèce" },
  { value: "Virement", label: "Virement" },
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

export const PLAN_LABELS: Record<Payment["planType"], string> = {
  one_time: "One-Time",
  semester: "Semester",
  monthly: "Monthly",
};

/** Program + training as one snapshot string, e.g. "BTP - Web Development". */
export function studentProgramSnapshot(student: Student): string {
  return [student.program, student.training].filter(Boolean).join(" - ");
}

/** What the Semester/Month column should read for a payment. */
export function paymentPeriodLabel(payment: Payment): string {
  if (payment.planType === "semester") return payment.semester ?? "—";
  if (payment.planType === "monthly") return payment.paymentMonth ?? "—";
  return "—";
}

/** Readable label for a stored payment_method value. */
export function formatPaymentMethod(value?: string): string {
  if (!value) return "—";
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}
