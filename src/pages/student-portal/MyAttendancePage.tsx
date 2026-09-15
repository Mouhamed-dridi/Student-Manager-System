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
import {
  errorMessage,
  loadStudentAttendance,
  type AttendanceRecord,
} from "@/lib/api";
import { loadCurrentStudent } from "./currentStudent";

export default function MyAttendancePage() {
  const [entries, setEntries] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Absence</h2>
        <span className="text-sm text-muted-foreground">
          {total} record{total === 1 ? "" : "s"}
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
                <TableHead>Time</TableHead>
                <TableHead>Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.time ?? "—"}</TableCell>
                  <TableCell>{e.className?.trim() ? e.className : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}