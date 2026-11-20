import { useCallback, useEffect, useState } from "react";
import { CalendarX, Eye, Printer, Search } from "lucide-react";
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
import { DataError, DataLoading } from "@/components/DataState";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useViewHistory } from "@/hooks/viewHistory";
import {
  errorMessage,
  listAbsenceBillets,
  type AbsenceBillet,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadBilletPrintCounts } from "@/lib/billetPrints";
import AbsenceBilletModal from "./AbsenceBilletModal";

const ICON_BUTTON_CLASS =
  "h-8 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white";

/** `2026-11-08` / `2026-11-08T…` → `08/11/2026`; invalid values show as stored. */
function formatAbsenceDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/**
 * Branch labels are written as "CAP · Vendeur caissier étalagiste" by the
 * planning, but older snapshots may use "-" or "/" as the separator; fold them
 * so the column reads the same everywhere. Other labels are kept as stored.
 */
function formatClassLabel(value: string | null): string {
  const label = value?.trim();
  if (!label) return "—";
  const match = /^(CAP|BTP|BTS)\s*[-–/·•]\s*(.+)$/i.exec(label);
  return match ? `${match[1].toUpperCase()} · ${match[2]}` : label;
}

// Archive of every generated student absence ticket. The rows are read-only
// snapshots: opening one only shows (and reprints) the stored ticket, it never
// archives a second copy.
export default function AbsenceBilletsView() {
  const { t } = useI18n();
  const [billets, setBillets] = useState<AbsenceBillet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openBillet, setOpenBillet] = useState<AbsenceBillet | null>(null);
  // Re-print opens the dialog and sends it straight to the printer; Preview
  // only shows the ticket.
  const [autoPrint, setAutoPrint] = useState(false);
  const { pushSection } = useViewHistory();

  const refresh = useCallback(async () => {
    try {
      const rows = await listAbsenceBillets();
      setBillets(rows);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    listAbsenceBillets()
      .then((rows) => {
        setBillets(rows);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useRefetchOnFocus(refresh);

  const query = search.trim().toLowerCase();
  const filtered =
    billets === null
      ? []
      : billets.filter(
          (billet) =>
            query === "" ||
            billet.studentName.toLowerCase().includes(query) ||
            (billet.className ?? "").toLowerCase().includes(query) ||
            (billet.subject ?? "").toLowerCase().includes(query) ||
            (billet.teacherName ?? "").toLowerCase().includes(query) ||
            formatAbsenceDate(billet.absenceDate).includes(query) ||
            (billet.absenceDate ?? "").includes(query) ||
            billet.code.toLowerCase().includes(query),
        );

  // Read on every render: the dialog closing re-renders the table, so a print
  // made from it shows up without extra state.
  const printCounts = loadBilletPrintCounts();

  const openTicket = (billet: AbsenceBillet, print: boolean) => {
    setAutoPrint(print);
    setOpenBillet(billet);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Absence Tickets")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("Every absence ticket generated from the attendance log.")}
          </p>
        </div>
        {billets !== null && (
          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 tabular-nums dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {billets.length === 1
              ? t("1 ticket")
              : t("{count} tickets", { count: billets.length })}
          </span>
        )}
      </div>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <Input
          placeholder={t("Search student, branch, subject, teacher...")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("Search student, branch, subject, teacher...")}
          className="h-8 border-zinc-200 bg-zinc-100/80 pl-9 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      <div className="space-y-4">
        {error && <DataError message={error} />}

        {billets === null && !error ? (
          <DataLoading label={t("Loading billets…")} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-800">
            <CalendarX className="mx-auto h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {query !== ""
                ? t("No billet matches your search.")
                : t("No billet has been generated yet.")}
            </p>
            {query === "" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => pushSection("absence", "Attendance Logs")}
              >
                {t("Open Attendance Logs")}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200 hover:bg-transparent dark:border-zinc-800">
                  <TableHead className="w-48">{t("Verification Code")}</TableHead>
                  <TableHead>{t("Student")}</TableHead>
                  <TableHead>{t("Class / Branch")}</TableHead>
                  <TableHead>{t("Subject")}</TableHead>
                  <TableHead>{t("Teacher")}</TableHead>
                  <TableHead className="w-32">{t("Absence Date")}</TableHead>
                  <TableHead className="w-28">{t("Time")}</TableHead>
                  <TableHead className="w-52">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((billet) => {
                  const printed = printCounts[billet.code] ?? 0;
                  return (
                    <TableRow
                      key={billet.id}
                      className="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <TableCell>
                        <span className="block font-mono text-xs font-medium break-all text-zinc-900 dark:text-zinc-100">
                          {billet.code}
                        </span>
                        {printed > 0 && (
                          <span className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">
                            {t("Printed")} ×{printed}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                        {billet.studentName}
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        {formatClassLabel(billet.className)}
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        {billet.subject?.trim() || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        {billet.teacherName?.trim() || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                        {formatAbsenceDate(billet.absenceDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                        {billet.timeSlot?.trim() || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={ICON_BUTTON_CLASS}
                            onClick={() => openTicket(billet, false)}
                            title={t("Preview")}
                            aria-label={t("Preview billet for {name}", {
                              name: billet.studentName,
                            })}
                          >
                            <Eye className="h-4 w-4" />
                            {t("Preview")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={ICON_BUTTON_CLASS}
                            onClick={() => openTicket(billet, true)}
                            title={t("Re-print")}
                            aria-label={t("View billet for {name}", {
                              name: billet.studentName,
                            })}
                          >
                            <Printer className="h-4 w-4" />
                            {t("Re-print")}
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

      {openBillet && (
        <AbsenceBilletModal
          key={`${openBillet.id}${autoPrint ? "-print" : "-preview"}`}
          billet={openBillet}
          autoPrint={autoPrint}
          onClose={() => setOpenBillet(null)}
        />
      )}
    </div>
  );
}
