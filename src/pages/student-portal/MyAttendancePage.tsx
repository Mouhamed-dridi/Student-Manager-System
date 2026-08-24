import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, loadPersonAttendance } from "@/lib/api";

interface AttendanceEntry {
  date: string;
  present: boolean;
}

export default function MyAttendancePage() {
  // No session id means there is nothing to load — start with an empty list.
  const [entries, setEntries] = useState<AttendanceEntry[] | null>(() =>
    localStorage.getItem("currentStudentId") ? null : [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("currentStudentId");
    if (!id) return;
    loadPersonAttendance("student", id)
      .then(setEntries)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const presentCount = (entries ?? []).filter((e) => e.present).length;
  const absentCount = (entries ?? []).length - presentCount;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Absence</h2>
        <span className="text-sm text-muted-foreground">
          {presentCount} present, {absentCount} absent
        </span>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {entries === null ? (
        !error && <DataLoading label="Loading attendance…" />
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No attendance records yet.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.date}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell className="text-right">
                    {e.present ? (
                      <span className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        Present
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Absent
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
