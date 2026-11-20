import { useMemo, useState } from "react";
import { Pencil, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";
import {
  PAYMENT_METHOD_OPTIONS,
  PLAN_TYPE_OPTIONS,
  formatMoney,
  formatPaymentMethod,
  paymentDateLabel,
  paymentMethodCategory,
  paymentPeriodLabel,
  planTypeLabel,
  type Payment,
} from "./paymentTypes";

interface PaymentsViewProps {
  payments: Payment[];
  /** Currency unit from center settings, e.g. "TND". */
  currency: string;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onPrint: (payment: Payment) => void;
}

/** One uniform monochrome pill for programs and payment methods. */
const BADGE_CLASS =
  "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

const FILTER_CLASS =
  "h-8 border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

/** Branch code ("CAP"/"BTP"/"BTS") from the snapshot or current record. */
function branchOf(payment: Payment): string {
  if (payment.program) return payment.program;
  return (payment.studentProgram ?? "").split(/[\s-]+/)[0]?.toUpperCase() ?? "";
}

export default function PaymentsView({
  payments,
  currency,
  onEdit,
  onDelete,
  onPrint,
}: PaymentsViewProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [plan, setPlan] = useState("all");
  const [method, setMethod] = useState("all");

  const hasActiveFilters =
    search.trim() !== "" || branch !== "all" || plan !== "all" || method !== "all";

  const handleClear = () => {
    setSearch("");
    setBranch("all");
    setPlan("all");
    setMethod("all");
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");
    const selectedMethod = paymentMethodCategory(method);

    return payments.filter((payment) => {
      if (branch !== "all" && branchOf(payment) !== branch) return false;
      if (plan !== "all" && payment.planType !== plan) return false;
      if (
        selectedMethod &&
        paymentMethodCategory(payment.paymentMethod) !== selectedMethod
      )
        return false;

      if (query) {
        const rawAmount = String(payment.amount ?? "");
        const matches = [
          payment.studentName,
          payment.studentProgram,
          payment.program,
          paymentDateLabel(payment.paymentDate),
          payment.paymentDate,
          payment.paymentMethod,
          formatPaymentMethod(payment.paymentMethod),
          planTypeLabel(payment.planType),
          paymentPeriodLabel(payment),
          payment.semester,
          payment.paymentMonth,
          rawAmount,
        ].some((value) => (value ?? "").toLowerCase().includes(query));
        if (matches) return true;
        if (
          queryDigits.length > 0 &&
          rawAmount.replace(/\D/g, "").includes(queryDigits)
        )
          return true;
        return false;
      }
      return true;
    });
  }, [payments, search, branch, plan, method]);

  const summary = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let total = 0;
    let month = 0;
    for (const payment of filtered) {
      total += payment.amount;
      if ((payment.paymentDate ?? "").slice(0, 7) === monthKey) {
        month += payment.amount;
      }
    }
    return { total, count: filtered.length, month };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            placeholder={t("Search payments...")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("Search payments...")}
            className="h-8 border-zinc-200 bg-zinc-100/80 pl-8 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <Select value={branch} onValueChange={(value) => setBranch(value ?? "all")}>
          <SelectTrigger className={`${FILTER_CLASS} w-32`} aria-label={t("Branch")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All")}</SelectItem>
            <SelectItem value="CAP">CAP</SelectItem>
            <SelectItem value="BTP">BTP</SelectItem>
            <SelectItem value="BTS">BTS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={plan} onValueChange={(value) => setPlan(value ?? "all")}>
          <SelectTrigger
            className={`${FILTER_CLASS} w-40`}
            aria-label={t("Plan Type")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All")}</SelectItem>
            {PLAN_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={method}
          onValueChange={(value) => setMethod(value ?? "all")}
        >
          <SelectTrigger
            className={`${FILTER_CLASS} w-44`}
            aria-label={t("Payment Method")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All")}</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t("Total Collected")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatMoney(summary.total, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t("Total Transactions")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {summary.count}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {t("Current Month Revenue")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatMoney(summary.month, currency)}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {payments.length === 0
            ? t("No payments recorded yet.")
            : t("No payments match your search or filters.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-200 hover:bg-transparent dark:border-zinc-800">
                <TableHead>{t("Student")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>{t("Branch / Program")}</TableHead>
                <TableHead>{t("Plan Type")}</TableHead>
                <TableHead>{t("Period")}</TableHead>
                <TableHead>{t("Payment Method")}</TableHead>
                <TableHead className="text-right">{t("Amount")}</TableHead>
                <TableHead className="w-32">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((payment) => {
                const method = payment.paymentMethod ?? "";
                const program = payment.studentProgram || payment.program;
                return (
                  <TableRow
                    key={payment.id}
                    className="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell className="font-medium">
                      {payment.studentName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {paymentDateLabel(payment.paymentDate)}
                    </TableCell>
                    <TableCell>
                      {program ? (
                        <span className={BADGE_CLASS}>{program}</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>{planTypeLabel(payment.planType)}</TableCell>
                    <TableCell>{paymentPeriodLabel(payment)}</TableCell>
                    <TableCell>
                      {method ? (
                        <span className={BADGE_CLASS}>
                          {formatPaymentMethod(method)}
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                      {formatMoney(payment.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Print receipt")}
                          aria-label={t("Print receipt for {name}", {
                            name: payment.studentName,
                          })}
                          onClick={() => onPrint(payment)}
                          className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Edit payment")}
                          aria-label={t("Edit payment for {name}", {
                            name: payment.studentName,
                          })}
                          onClick={() => onEdit(payment)}
                          className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Move to trash")}
                          aria-label={t("Delete payment for {name}", {
                            name: payment.studentName,
                          })}
                          onClick={() => onDelete(payment)}
                          className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
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
        </div>
      )}
    </div>
  );
}
