import { useState } from "react";
import { Search } from "lucide-react";
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
import type { AttendanceRecord } from "@/lib/api";

interface AttendanceLogProps {
  records: AttendanceRecord[] | null;
  error: string | null;
  loading: boolean;
}

export default function AttendanceLog({
  records,
  error,
  loading,
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
            (r.className ?? "").toLowerCase().includes(query),
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
              <TableHead>Class / Program / Specialty</TableHead>
              <TableHead className="w-36">Date</TableHead>
              <TableHead className="w-28">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span
                    className={
                      r.type === "student"
                        ? "inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
                        : "inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400"
                    }
                  >
                    {r.type === "student" ? "Student" : "Teacher"}
                  </span>
                </TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell>{r.className?.trim() ? r.className : "—"}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.time ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}