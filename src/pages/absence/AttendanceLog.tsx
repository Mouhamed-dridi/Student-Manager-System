import { useMemo, useState } from "react";
import { Pencil, Search, Ticket, Trash2 } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataError, DataLoading } from "@/components/DataState";
import { useT } from "@/lib/i18n";
import type {
  AttendanceRecord,
  AttendanceTargetType,
} from "@/lib/api";

// One badge per recorded target; full-class rows are a whole branch, not a
// person, so they get an outline treatment instead of a filled one. The whole
// page is strictly monochrome, so no badge carries a colour.
const TYPE_BADGES: Record<AttendanceTargetType, { label: string; className: string }> =
  {
    student: {
      label: "Student",
      className:
        "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
    },
    teacher: {
      label: "Teacher",
      className:
        "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
    },
    full_class: {
      label: "Full class",
      className:
        "border-zinc-300 bg-transparent text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
    },
  };

const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";

const FILTER_CLASS =
  "h-8 border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

const ICON_CLASS =
  "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white";

const BRANCH_CODES = ["CAP", "BTP", "BTS"] as const;

/**
 * "09:00" stays as is, a stored "09:00:00" loses the seconds, and anything
 * else (unexpected format) is shown untouched rather than hidden.
 */
function displayTime(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  const match = /^(\d{1,2}):(\d{2})(?::\d\d(?:\.\d+)?)?$/.exec(trimmed);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : trimmed;
}

/** `2025-09-01` / `2025-09-01T…` → `01/09/2025`; anything else is kept. */
function displayDate(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  const [year, month, day] = trimmed.split("T")[0].split("-");
  if (!year || !month || !day) return trimmed;
  return `${day}/${month}/${year}`;
}

/** The CAP/BTP/BTS branch a log row belongs to, when its program has one. */
function branchOf(record: AttendanceRecord): string {
  const program = (record.program ?? "").trim().toUpperCase();
  return BRANCH_CODES.find((code) => program.startsWith(code)) ?? "";
}

/**
 * Time From / Time To cells for one row. Rows written since the migration carry
 * both columns; older ones only have a single `time` value (which newer code
 * may have stored as a "08:00 - 10:00" window), so it is split when it looks
 * like a range and otherwise shown under Time From.
 */
function timesForRow(record: AttendanceRecord): { from: string; to: string } {
  if (record.timeFrom || record.timeTo) {
    return {
      from: displayTime(record.timeFrom),
      to: displayTime(record.timeTo),
    };
  }
  const legacy = record.time?.trim();
  if (!legacy) return { from: "—", to: "—" };
  const [from = "", to = ""] = legacy.split(/\s*[–-]\s*/);
  return { from: displayTime(from), to: displayTime(to) };
}

interface AttendanceLogProps {
  records: AttendanceRecord[] | null;
  error: string | null;
  loading: boolean;
  onEdit: (record: AttendanceRecord) => void;
  onDelete: (id: string) => void;
  /** Generates (and archives) the absence billet for a student row. */
  onTicket: (record: AttendanceRecord) => void;
}

export default function AttendanceLog({
  records,
  error,
  loading,
  onEdit,
  onDelete,
  onTicket,
}: AttendanceLogProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [branch, setBranch] = useState("all");

  const hasActiveFilters =
    search.trim() !== "" || type !== "all" || branch !== "all";

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (records ?? []).filter((record) => {
      if (type !== "all" && record.type !== type) return false;
      if (branch !== "all" && branchOf(record) !== branch) return false;
      if (!query) return true;
      return [
        record.fullName,
        record.className,
        record.program,
        record.training,
      ].some((value) => (value ?? "").toLowerCase().includes(query));
    });
  }, [records, search, type, branch]);

  const clearFilters = () => {
    setSearch("");
    setType("all");
    setBranch("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            placeholder={t("Search by name or class...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("Search by name or class...")}
            className="h-8 border-zinc-200 bg-zinc-100/80 pl-8 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
          <SelectTrigger className={`${FILTER_CLASS} w-36`} aria-label={t("Type")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All")}</SelectItem>
            <SelectItem value="student">{t("Students")}</SelectItem>
            <SelectItem value="teacher">{t("Teachers")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={branch}
          onValueChange={(value) => setBranch(value ?? "all")}
        >
          <SelectTrigger
            className={`${FILTER_CLASS} w-32`}
            aria-label={t("Program")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All")}</SelectItem>
            {BRANCH_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {error && <DataError message={error} />}

      {loading ? (
        <DataLoading label={t("Loading attendance…")} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {hasActiveFilters
            ? t("No records match your search or filters.")
            : t("No attendance records yet.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-200 hover:bg-transparent dark:border-zinc-800">
                <TableHead className="w-28">{t("Type")}</TableHead>
                <TableHead>{t("Full Name")}</TableHead>
                <TableHead className="w-24">{t("Program")}</TableHead>
                <TableHead>{t("Training")}</TableHead>
                <TableHead className="w-28">{t("Date")}</TableHead>
                <TableHead className="w-24">{t("Time From")}</TableHead>
                <TableHead className="w-24">{t("Time To")}</TableHead>
                <TableHead className="w-24">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => {
                const badge = TYPE_BADGES[record.type] ?? TYPE_BADGES.student;
                const times = timesForRow(record);
                return (
                  <TableRow
                    key={record.id}
                    className="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell>
                      <span className={`${BADGE_BASE} ${badge.className}`}>
                        {t(badge.label)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.fullName}
                    </TableCell>
                    <TableCell className="text-zinc-500 dark:text-zinc-400">
                      {record.program?.trim() ? record.program : "—"}
                    </TableCell>
                    <TableCell>
                      {record.training?.trim() ? record.training : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {displayDate(record.date)}
                    </TableCell>
                    <TableCell>{times.from}</TableCell>
                    <TableCell>{times.to}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Only people get an absence ticket: a full-class row is a
                            whole branch, so there is no student to hand it to. */}
                        {record.type === "student" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onTicket(record)}
                            className={ICON_CLASS}
                            title={t("Generate absence billet")}
                            aria-label={t("Generate absence billet for {name}", {
                              name: record.fullName,
                            })}
                          >
                            <Ticket className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(record)}
                          className={ICON_CLASS}
                          aria-label={t("Edit {name}", { name: record.fullName })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className={ICON_CLASS}
                                aria-label={t("Delete {name}", {
                                  name: record.fullName,
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("Move to Trash?")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t(
                                  "{name} on {date} will move to the Trash, where you can restore it later or delete it permanently.",
                                  {
                                    name: record.fullName,
                                    date:
                                      displayDate(record.date) +
                                      (record.time
                                        ? ` · ${displayTime(record.time)}`
                                        : ""),
                                  },
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(record.id)}>
                                {t("Delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
