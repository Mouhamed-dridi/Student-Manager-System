import { useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import type {
  AttendanceRecord,
  AttendanceTargetType,
} from "@/lib/api";

// One badge per recorded target; full-class rows are a whole branch, not a
// person, so they get their own colour and label.
const TYPE_BADGES: Record<
  AttendanceTargetType,
  { label: string; className: string }
> = {
  student: {
    label: "Student",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  teacher: {
    label: "Teacher",
    className:
      "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  full_class: {
    label: "Full class",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

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
}

export default function AttendanceLog({
  records,
  error,
  loading,
  onEdit,
  onDelete,
}: AttendanceLogProps) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered =
    records === null
      ? []
      : records.filter(
          (r) =>
            query === "" ||
            r.fullName.toLowerCase().includes(query) ||
            (r.className ?? "").toLowerCase().includes(query) ||
            (r.program ?? "").toLowerCase().includes(query) ||
            (r.training ?? "").toLowerCase().includes(query),
        );

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {error && <DataError message={error} />}

      {loading ? (
        <DataLoading label="Loading attendance…" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query !== ""
            ? "No records match your search."
            : "No attendance records yet."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Type</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead className="w-24">Program</TableHead>
              <TableHead>Training</TableHead>
              <TableHead className="w-36">Date</TableHead>
              <TableHead className="w-24">Time From</TableHead>
              <TableHead className="w-24">Time To</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      (TYPE_BADGES[r.type] ?? TYPE_BADGES.student).className
                    }`}
                  >
                    {(TYPE_BADGES[r.type] ?? TYPE_BADGES.student).label}
                  </span>
                </TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell>{r.program?.trim() ? r.program : "—"}</TableCell>
                <TableCell>{r.training?.trim() ? r.training : "—"}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{timesForRow(r).from}</TableCell>
                <TableCell>{timesForRow(r).to}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(r)}
                      aria-label={`Edit ${r.fullName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${r.fullName}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {r.fullName} on {r.date}
                            {r.time ? ` at ${r.time}` : ""} will move to the Trash,
                            where you can restore it later or delete it
                            permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(r.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}