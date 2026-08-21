import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Student } from "./StudentForm";

interface StudentImportPreviewProps {
  rows: Student[];
  skipped: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function StudentImportPreview({
  rows,
  skipped,
  onConfirm,
  onCancel,
}: StudentImportPreviewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} row{rows.length === 1 ? "" : "s"} ready to import
        {skipped > 0
          ? `, ${skipped} row${skipped === 1 ? "" : "s"} will be skipped (missing or invalid data).`
          : "."}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Training</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((student) => (
            <TableRow key={student.id}>
              <TableCell>{student.fullName}</TableCell>
              <TableCell>{student.program}</TableCell>
              <TableCell>{student.training}</TableCell>
              <TableCell>{student.phone}</TableCell>
              <TableCell>{student.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex gap-2">
        <Button onClick={onConfirm}>Confirm Import</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
