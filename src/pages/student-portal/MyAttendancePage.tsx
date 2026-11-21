import { useEffect, useMemo, useState } from "react";
import { CalendarX, Clock, GraduationCap, Hash } from "lucide-react";
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
  loadStudentAttendance,
  type AttendanceRecord,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { loadCurrentStudent } from "./currentStudent";

export default function MyAttendancePage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then((student) => {
        if (!student) {
          if (!cancelled) setEntries([]);
          return;
        }
        return loadStudentAttendance(student.fullName).then((rows) => {
          if (!cancelled) setEntries(rows);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = (entries ?? []).length;

  // Distinct classes found in the records
  const classes = useMemo(() => {
    if (!entries) return [];
    const set = new Set<string>();
    for (const e of entries) {
      const c = e.className?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [entries]);

  // Most recent absence date
  const latestDate = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries[0].date; // already sorted desc by the API
  }, [entries]);

  // Filtered entries
  const filtered = useMemo(() => {
    if (!entries) return null;
    if (!filter) return entries;
    const q = filter.toLowerCase();
    return entries.filter(
      (e) =>
        e.date.toLowerCase().includes(q) ||
        (e.time ?? "").toLowerCase().includes(q) ||
        (e.className ?? "").toLowerCase().includes(q),
    );
  }, [entries, filter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{t("Absences")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("Attendance entries logged against your name.")}
          </p>
        </div>
        <span className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium tabular-nums text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {t("{count} records", { count: total })}
        </span>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {entries === null ? (
        !error && <DataLoading label={t("Loading attendance…")} />
      ) : entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <CalendarX className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium">
            {t("No attendance records yet.")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("No absences have been recorded for your account.")}
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                {t("Total Absences")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {total}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t("Latest Absence")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {latestDate ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                {t("Classes")}
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {classes.length}
              </p>
            </div>
          </div>

          {/* Search filter */}
          <div className="mt-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("Search by date, time or class…")}
              className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          {/* Table */}
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-200 dark:border-zinc-800">
                  <TableHead>{t("Date")}</TableHead>
                  <TableHead>{t("Time")}</TableHead>
                  <TableHead>{t("Class")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filtered ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {t("No results match your search.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  (filtered ?? []).map((e) => (
                    <TableRow
                      key={e.id}
                      className="border-zinc-200 dark:border-zinc-800"
                    >
                      <TableCell className="tabular-nums">{e.date}</TableCell>
                      <TableCell className="tabular-nums">
                        {e.time ?? "—"}
                      </TableCell>
                      <TableCell>
                        {e.className?.trim() ? (
                          <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800">
                            {e.className}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
