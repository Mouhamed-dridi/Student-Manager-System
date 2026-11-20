import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";
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
  const t = useT();

  const ready =
    rows.length === 1
      ? t("1 row ready to import")
      : t("{count} rows ready to import", { count: rows.length });
  const skippedText =
    skipped > 0
      ? skipped === 1
        ? t(", 1 row will be skipped (missing or invalid data).")
        : t(", {count} rows will be skipped (missing or invalid data).", {
            count: skipped,
          })
      : ".";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ready}
        {skippedText}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Full Name")}</TableHead>
            <TableHead>{t("Branch")}</TableHead>
            <TableHead>{t("Program")}</TableHead>
            <TableHead>{t("Phone")}</TableHead>
            <TableHead>{t("Email")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((student) => (
            <TableRow key={student.id}>
              <TableCell>{student.fullName}</TableCell>
              <TableCell>{student.program}</TableCell>
              <TableCell>
                {student.training ? (
                  student.training
                ) : (
                  <span className="text-zinc-500">{t("Unassigned")}</span>
                )}
              </TableCell>
              <TableCell>{student.phone}</TableCell>
              <TableCell>{student.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {t("Confirm Import")}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  );
}
