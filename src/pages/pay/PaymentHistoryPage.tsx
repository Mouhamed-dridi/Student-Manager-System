import { useEffect, useMemo, useState } from "react";
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
import {
  errorMessage,
  listPaymentHistory,
  paymentsSupportsHistory,
  type PaymentHistoryItem,
} from "@/lib/api";

export default function PaymentHistoryPage() {
  const [items, setItems] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [historyAvailable, setHistoryAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPaymentHistory(), paymentsSupportsHistory()])
      .then(([rows, available]) => {
        if (!cancelled) {
          setItems(rows);
          setHistoryAvailable(available);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter((item) =>
      item.studentName.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Payment History</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every edit made to a payment is appended to that payment's edit
        history and shown here, newest first.
      </p>

      <div className="mt-4">
        {error && <DataError message={error} />}
      </div>

      <div className="mt-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {items === null ? (
          !error && <DataLoading label="Loading history…" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? historyAvailable
                ? "No payment edits recorded yet."
                : "Edit history is not available on this database — the payments table has no edit_history column, so only edits from this session appear here."
              : "No records match your search."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead className="w-28">Changed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={`${item.paymentId}${item.entry.changedAt}`}>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.entry.changedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{item.studentName}</TableCell>
                  <TableCell>
                    <ul className="space-y-0.5">
                      {item.entry.changes.length === 0 ? (
                        <li className="text-sm text-muted-foreground">
                          No field changes
                        </li>
                      ) : (
                        item.entry.changes.map((c) => (
                          <li key={`${c.field}${c.from}${c.to}`} className="text-sm">
                            {c.field}: {c.from} → {c.to}
                          </li>
                        ))
                      )}
                    </ul>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.entry.changedBy ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}