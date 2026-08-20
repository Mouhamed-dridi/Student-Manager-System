import { useState } from "react";
import { Printer, Ticket } from "lucide-react";
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
import type { Payment } from "./PaymentForm";

interface PaymentListProps {
  payments: Payment[];
  onPrintReceipt: (payment: Payment) => void;
  onPrintTicket: (payment: Payment) => void;
}

const PLAN_LABELS: Record<Payment["planType"], string> = {
  "one-time": "One-time",
  semester: "Semester",
  monthly: "Monthly",
};

export default function PaymentList({
  payments,
  onPrintReceipt,
  onPrintTicket,
}: PaymentListProps) {
  const [search, setSearch] = useState("");

  const filtered = payments.filter((p) =>
    p.studentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by student name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {payments.length === 0
            ? "No payments recorded yet."
            : "No payments match your search."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Plan Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.studentName}</TableCell>
                <TableCell>{p.amount.toFixed(2)}</TableCell>
                <TableCell>{PLAN_LABELS[p.planType]}</TableCell>
                <TableCell>{p.date}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Print Receipt"
                      onClick={() => onPrintReceipt(p)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Print Ticket"
                      onClick={() => onPrintTicket(p)}
                    >
                      <Ticket className="h-4 w-4" />
                    </Button>
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
