import { useCallback, useEffect, useState } from "react";
import { CalendarX, Printer, Search } from "lucide-react";
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
import AbsenceBilletModal from "./AbsenceBilletModal";

/** `2026-11-08` → `8 Nov 2026`; invalid values are shown as stored. */
function formatAbsenceDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Archive of every generated student absence ticket. The rows are read-only
// snapshots: opening one only shows (and reprints) the stored ticket, it never
// archives a second copy.
export default function AbsenceBilletsView() {
  const [billets, setBillets] = useState<AbsenceBillet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openBillet, setOpenBillet] = useState<AbsenceBillet | null>(null);
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
            (billet.absenceDate ?? "").includes(query) ||
            billet.code.toLowerCase().includes(query),
        );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold">Billets / Tickets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every absence ticket generated from the attendance log.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {billets === null
            ? ""
            : `${billets.length} billet${billets.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="relative mt-4 w-full max-w-xs">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student, class, subject, teacher or code..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="mt-4 space-y-4">
        {error && <DataError message={error} />}

        {billets === null && !error ? (
          <DataLoading label="Loading billets…" />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <CalendarX className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {query !== ""
                ? "No billet matches your search."
                : "No billet has been generated yet."}
            </p>
            {query === "" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => pushSection("absence", "Attendance Logs")}
              >
                Open Attendance Logs
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Verification Code</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class / Branch</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="w-40">Absence Date</TableHead>
                <TableHead className="w-28">Time</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((billet) => (
                <TableRow key={billet.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {billet.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    {billet.studentName}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {billet.className || "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {billet.subject || "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {billet.teacherName || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatAbsenceDate(billet.absenceDate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {billet.timeSlot || "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenBillet(billet)}
                      aria-label={`View billet for ${billet.studentName}`}
                    >
                      <Printer className="h-4 w-4" />
                      Re-print
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {openBillet && (
        <AbsenceBilletModal
          key={openBillet.id}
          billet={openBillet}
          onClose={() => setOpenBillet(null)}
        />
      )}
    </div>
  );
}
