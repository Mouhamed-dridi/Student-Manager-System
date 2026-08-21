import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeacherImportRow } from "./importTeachers";

interface TeacherImportPreviewProps {
  rows: TeacherImportRow[];
  missingData: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TeacherImportPreview({
  rows,
  missingData,
  onConfirm,
  onCancel,
}: TeacherImportPreviewProps) {
  const newCount = rows.filter((r) => !r.duplicate).length;
  const duplicateCount = rows.length - newCount;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {newCount} teacher{newCount === 1 ? "" : "s"} ready to import
        {duplicateCount > 0
          ? `, ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} will be skipped`
          : ""}
        {missingData > 0
          ? `, ${missingData} row${missingData === 1 ? "" : "s"} ignored for missing data.`
          : "."}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-24">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ teacher, duplicate }) => (
            <TableRow key={teacher.id}>
              <TableCell>{teacher.fullName}</TableCell>
              <TableCell>{teacher.subject}</TableCell>
              <TableCell>{teacher.phone}</TableCell>
              <TableCell>{teacher.email}</TableCell>
              <TableCell
                className={
                  duplicate ? "text-muted-foreground" : undefined
                }
              >
                {duplicate ? "Duplicate" : "New"}
              </TableCell>
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
