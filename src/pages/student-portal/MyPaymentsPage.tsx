import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Hourglass,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  getSettings,
  listPayments,
  subscribeToTable,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getCurrentStudentId } from "@/lib/session";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  DEFAULT_CURRENCY,
  PLAN_LABELS,
  formatMoney,
  paymentDateLabel,
  paymentPeriodLabel,
  type Payment,
} from "@/pages/pay/paymentTypes";
import PaymentReceiptModal from "@/pages/pay/PaymentReceiptModal";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

function normalizeStatus(status?: string): "paid" | "pending" | "partial" {
  const s = (status ?? "paid").toLowerCase().trim();
  if (s === "pending" || s === "en attente") return "pending";
  if (s === "partial" || s === "partiel") return "partial";
  return "paid";
}

export default function MyPaymentsPage() {
  const { t } = useI18n();
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(() =>
    getCurrentStudentId() ? null : [],
  );
  const [centerName, setCenterName] = useState("SSM");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [error, setError] = useState<string | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  const loadData = useCallback(() => {
    const id = getCurrentStudentId();
    if (!id) return;
    listPayments()
      .then((all) => {
        setError(null);
        setPayments(
          all
            .filter((p) => p.studentId === id)
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
        );
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    loadData();
    Promise.all([
      loadCurrentStudent(),
      getSettings().catch(() => null),
    ]).then(([s, settings]) => {
      if (s) setStudent(s);
      if (settings) {
        if (settings.systemName?.trim()) setCenterName(settings.systemName.trim());
        if (settings.currency?.trim()) setCurrency(settings.currency.trim());
      }
    });

    const unsubscribe = subscribeToTable("payments", loadData);
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  useRefetchOnFocus(loadData);

  const summary = useMemo(() => {
    const list = payments ?? [];
    let totalPaid = 0;
    let remainingBalance = 0;

    for (const p of list) {
      const st = normalizeStatus(p.status);
      if (st === "paid") {
        totalPaid += p.amount;
      } else {
        remainingBalance += p.amount;
      }
    }

    const lastPayment = list.length > 0 ? list[0] : null;

    return {
      totalPaid,
      remainingBalance,
      lastPayment,
      count: list.length,
    };
  }, [payments]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{t("My Payments")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("Track your payments and tuition installments.")}
          </p>
        </div>
        {payments && payments.length > 0 && (
          <span className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium tabular-nums text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {t("{count} records", { count: summary.count })}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {payments === null ? (
        !error && <DataLoading label={t("Loading history…")} />
      ) : payments.length === 0 ? (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <CreditCard className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium">
            {t("No payments recorded yet.")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Track your payments and tuition installments.")}
          </p>
        </div>
      ) : (
        <>
          {/* Monochromatic Zinc Summary Strip (3 cards) */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("Total Paid")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatMoney(summary.totalPaid, currency)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hourglass className="h-3.5 w-3.5" />
                {t("Remaining Balance")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatMoney(summary.remainingBalance, currency)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3.5 w-3.5" />
                {t("Last Payment")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {summary.lastPayment
                  ? formatMoney(summary.lastPayment.amount, currency)
                  : "—"}
              </p>
              {summary.lastPayment && (
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {paymentDateLabel(summary.lastPayment.paymentDate)}
                </p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200 dark:border-zinc-800">
                  <TableHead>{t("Date")}</TableHead>
                  <TableHead>{t("Amount")}</TableHead>
                  <TableHead>{t("Plan Type")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const st = normalizeStatus(p.status);
                  const period = paymentPeriodLabel(p);

                  return (
                    <TableRow
                      key={p.id}
                      className="border-zinc-200 dark:border-zinc-800"
                    >
                      <TableCell className="tabular-nums font-medium">
                        {paymentDateLabel(p.paymentDate)}
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatMoney(p.amount, currency)}
                      </TableCell>
                      <TableCell>
                        <span>{t(PLAN_LABELS[p.planType] ?? p.planType)}</span>
                        {period !== "—" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({period})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {st === "paid" && (
                          <span className="inline-flex items-center rounded-full border border-transparent bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-950">
                            {t("Paid")}
                          </span>
                        )}
                        {st === "pending" && (
                          <span className="inline-flex items-center rounded-full border border-dashed border-zinc-300 bg-transparent px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                            {t("Pending")}
                          </span>
                        )}
                        {st === "partial" && (
                          <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {t("Partial")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {st === "paid" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-zinc-200 text-xs font-medium dark:border-zinc-800"
                            onClick={() => setReceiptPayment(p)}
                          >
                            <Receipt className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                            {t("Receipt")}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Printable Receipt Modal */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          student={student ?? undefined}
          centerName={centerName}
          currency={currency}
          open={receiptPayment !== null}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}
