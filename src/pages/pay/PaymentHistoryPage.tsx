import { useEffect, useMemo, useState } from "react";
import { FilePlus2, PencilLine, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  listPaymentHistory,
  paymentsSupportsHistory,
  type PaymentFieldChange,
  type PaymentHistoryAction,
  type PaymentHistoryItem,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "./paymentTypes";

type HistoryFilter = "all" | PaymentHistoryAction;

/** Badge word per action; also used for the search text. */
const ACTION_LABEL: Record<PaymentHistoryAction, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
};

const ACTION_ICON: Record<PaymentHistoryAction, typeof FilePlus2> = {
  created: FilePlus2,
  updated: PencilLine,
  deleted: Trash2,
};

/** Filter pills. Keys differ from the badges so French can use plurals. */
const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "created", label: "Creations" },
  { value: "updated", label: "Updates" },
  { value: "deleted", label: "Deletions" },
];

const BADGE_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

const PILL_BASE =
  "h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors";

const PILL_ACTIVE =
  "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

const PILL_IDLE =
  "border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

function actionOf(item: PaymentHistoryItem): PaymentHistoryAction {
  return item.entry.actionType ?? "updated";
}

/** The rows shown under a badge: field diffs for edits, a snapshot otherwise. */
function detailRows(item: PaymentHistoryItem): PaymentFieldChange[] {
  if (actionOf(item) === "updated") return item.entry.changes;
  return item.entry.details ?? item.entry.changes;
}

export default function PaymentHistoryPage() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPaymentHistory(),
      paymentsSupportsHistory(),
      getSettings().catch(() => null),
    ])
      .then(([rows, available, settings]) => {
        if (!cancelled) {
          setItems(rows);
          setHistoryAvailable(available);
          setCurrency(settings?.currency?.trim() ?? "");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const money = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? formatMoney(parsed, currency) : value;
  };

  const fieldLabel = (field: string) => t(field);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      if (filter !== "all" && actionOf(item) !== filter) return false;
      if (!query) return true;
      const haystack = [
        item.studentName || t("Unknown student"),
        item.entry.changedBy ?? "",
        t(ACTION_LABEL[actionOf(item)]),
        ...detailRows(item).map(
          (change) =>
            `${t(change.field)} ${change.field} ${change.from} ${change.to}`,
        ),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    // `t` follows the active language, so the memo must too.
  }, [items, search, filter, t]);

  const locale = language === "fr" ? "fr-FR" : "en-GB";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("Payment History")}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t(
            "Every payment creation, edit and deletion is recorded here, newest first.",
          )}
        </p>
      </div>

      {error && <DataError message={error} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            placeholder={t("Search by student, change or user…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("Search by student, change or user…")}
            className="h-8 border-zinc-200 bg-zinc-100/80 pl-8 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t("Filter by action")}
        >
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`${PILL_BASE} ${
                filter === option.value ? PILL_ACTIVE : PILL_IDLE
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        !error && <DataLoading label={t("Loading history…")} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {items.length === 0
            ? historyAvailable
              ? t("No payment activity recorded yet.")
              : t(
                  "Payment history is not available on this database — the payments table has no edit_history column, so only changes made in this session are listed here.",
                )
            : t("No records match your search or filters.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-200 hover:bg-transparent dark:border-zinc-800">
                <TableHead className="w-44">{t("Date")}</TableHead>
                <TableHead className="w-52">{t("Student")}</TableHead>
                <TableHead>{t("Changes")}</TableHead>
                <TableHead className="w-32">{t("By")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const action = actionOf(item);
                const Icon = ACTION_ICON[action];
                const details = detailRows(item);
                return (
                  <TableRow
                    key={`${item.paymentId}${item.entry.changedAt}`}
                    className="border-zinc-200 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {new Date(item.entry.changedAt).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.studentName || t("Unknown student")}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <span className={BADGE_CLASS}>
                          <Icon className="h-3 w-3" />
                          {t(ACTION_LABEL[action])}
                        </span>
                        {details.length === 0 ? (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {t("No field details")}
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {details.map((change, index) => (
                              <li
                                key={`${change.field}${change.from}${change.to}${index}`}
                                className="text-sm text-zinc-700 dark:text-zinc-300"
                              >
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  {fieldLabel(change.field)}:
                                </span>{" "}
                                {action === "updated" ? (
                                  <>
                                    {change.field === "Amount"
                                      ? money(change.from)
                                      : change.from}{" "}
                                    →{" "}
                                    {change.field === "Amount"
                                      ? money(change.to)
                                      : change.to}
                                  </>
                                ) : change.field === "Amount" ? (
                                  money(change.to)
                                ) : (
                                  change.to
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 dark:text-zinc-400">
                      {item.entry.changedBy || "—"}
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
