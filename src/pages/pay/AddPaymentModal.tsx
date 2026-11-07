import { useRef, useState } from "react";
import { GraduationCap, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStudentById } from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import {
  MONTH_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SEMESTER_OPTIONS,
  studentProgramSnapshot,
  type Payment,
  type PaymentMethod,
} from "./paymentTypes";

interface AddPaymentModalProps {
  open: boolean;
  students: Student[];
  /** Pre-fills the form to edit an existing payment instead of adding one. */
  initial?: Payment | null;
  /** Save error from the page; shown inside the dialog, not behind it. */
  error?: string | null;
  onSave: (payment: Payment) => void | Promise<void>;
  onClose: () => void;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Add / edit payment dialog.
 *
 * The plan type drives which period field is shown (semester vs month), and
 * picking a student snapshots their program/specialty into `student_program`
 * so the payment row still reads correctly if the student later changes class.
 */
export default function AddPaymentModal({
  open,
  students,
  initial,
  error,
  onSave,
  onClose,
}: AddPaymentModalProps) {
  const isEditing = Boolean(initial);
  const initialStudent = initial
    ? (students.find((student) => student.id === initial.studentId) ?? null)
    : null;

  const [nameInput, setNameInput] = useState(initial?.studentName ?? "");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    initialStudent,
  );
  const [studentProgram, setStudentProgram] = useState(
    initial?.studentProgram ??
      (initialStudent ? studentProgramSnapshot(initialStudent) : ""),
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [planType, setPlanType] = useState<Payment["planType"]>(
    initial?.planType ?? "one_time",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? "check",
  );
  const [semester, setSemester] = useState<string>(
    initial?.semester ?? SEMESTER_OPTIONS[0],
  );
  const [paymentMonth, setPaymentMonth] = useState<string>(
    initial?.paymentMonth ?? MONTH_OPTIONS[new Date().getMonth()],
  );
  const [date, setDate] = useState(initial?.paymentDate ?? todayString());
  const [submitting, setSubmitting] = useState(false);

  // Guards the async student refresh: a slow response for a previously picked
  // student must not overwrite the one the operator selected afterwards.
  const selectedIdRef = useRef<string | null>(initialStudent?.id ?? null);

  const query = nameInput.trim().toLowerCase();
  const matches =
    !selectedStudent && query
      ? students.filter((student) =>
          student.fullName.toLowerCase().includes(query),
        )
      : [];

  const handleNameChange = (value: string) => {
    setNameInput(value);
    if (
      selectedStudent &&
      value.toLowerCase() !== selectedStudent.fullName.toLowerCase()
    ) {
      selectedIdRef.current = null;
      setSelectedStudent(null);
      setStudentProgram("");
    }
  };

  const handlePickStudent = (student: Student) => {
    selectedIdRef.current = student.id;
    setSelectedStudent(student);
    setNameInput(student.fullName);
    setStudentProgram(studentProgramSnapshot(student));

    // Re-read the row so a program/specialty edited elsewhere is not stale.
    void getStudentById(student.id)
      .then((fresh) => {
        if (!fresh || selectedIdRef.current !== fresh.id) return;
        setSelectedStudent(fresh);
        setStudentProgram(studentProgramSnapshot(fresh));
      })
      .catch(() => {
        // Keep the roster copy; the snapshot above is still valid.
      });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent) return;

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount)) return;

    setSubmitting(true);
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(),
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        program: selectedStudent.program ?? initial?.program,
        studentProgram:
          studentProgram || studentProgramSnapshot(selectedStudent),
        amount: parsedAmount,
        planType,
        paymentMethod,
        semester: planType === "semester" ? semester : undefined,
        paymentMonth: planType === "monthly" ? paymentMonth : undefined,
        paymentDate: date,
        // Status is no longer chosen in the UI: every recorded payment is paid.
        status: "paid",
        deletedAt: initial?.deletedAt,
        createdAt: initial?.createdAt,
      });
    } catch {
      // The page keeps the save error and passes it back in through `error`,
      // so the dialog stays open with the values the operator just typed.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Payment" : "Add Payment"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify this payment's details. The change is recorded in the history log."
              : "Record a new payment against a student."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ----------------------------------------------------- student */}
          <div className="space-y-2">
            <Label htmlFor="payment-student">Student</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="payment-student"
                className="pl-8"
                placeholder="Type a student name..."
                value={nameInput}
                onChange={(event) => handleNameChange(event.target.value)}
                autoComplete="off"
              />
              {matches.length > 0 && (
                <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover py-1 shadow-md">
                  {matches.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handlePickStudent(student)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      {student.fullName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!selectedStudent && query && matches.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No students match "{nameInput.trim()}".
              </p>
            )}

            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Specialty / Program
                </p>
                <p className="truncate text-sm font-medium">
                  {studentProgram || "Select a student to auto-fill"}
                </p>
              </div>
            </div>
          </div>

          {/* ----------------------------------------- amount + plan type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Plan Type</Label>
              <Select
                value={planType}
                onValueChange={(value) =>
                  setPlanType(value as Payment["planType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-Time</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ------------------------------------- conditional plan period */}
          {planType === "semester" && (
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select
                value={semester}
                onValueChange={(value) => value && setSemester(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {planType === "monthly" && (
            <div className="space-y-2">
              <Label>Payment Month</Label>
              <Select
                value={paymentMonth}
                onValueChange={(value) => value && setPaymentMonth(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* -------------------------------------- method + payment date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  value && setPaymentMethod(value as PaymentMethod)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedStudent || !amount || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : "Add Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
