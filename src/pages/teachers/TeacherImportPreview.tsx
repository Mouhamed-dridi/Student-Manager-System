import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPersonName, formatPhone } from "@/lib/format";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const newCount = rows.filter((r) => !r.duplicate).length;
  const duplicateCount = rows.length - newCount;

  const ready =
    newCount === 1
      ? t("1 teacher ready to import")
      : t("{count} teachers ready to import", { count: newCount });
  const duplicatesText =
    duplicateCount > 0
      ? duplicateCount === 1
        ? t(", 1 duplicate will be skipped")
        : t(", {count} duplicates will be skipped", { count: duplicateCount })
      : "";
  const missingText =
    missingData > 0
      ? missingData === 1
        ? t(", 1 row ignored for missing data.")
        : t(", {count} rows ignored for missing data.", { count: missingData })
      : ".";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ready}
        {duplicatesText}
        {missingText}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Full Name")}</TableHead>
            <TableHead>{t("Specialty")}</TableHead>
            <TableHead>{t("Phone")}</TableHead>
            <TableHead>{t("Email")}</TableHead>
            <TableHead className="w-24">{t("Status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ teacher, duplicate }) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">
                {formatPersonName(teacher.fullName)}
              </TableCell>
              <TableCell>
                {teacher.specialty ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    {teacher.specialty}
                  </span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </TableCell>
              <TableCell>{formatPhone(teacher.phone ?? "")}</TableCell>
              <TableCell>{teacher.email}</TableCell>
              <TableCell>
                <span
                  className={
                    duplicate
                      ? "text-zinc-500 dark:text-zinc-400"
                      : "font-medium text-zinc-900 dark:text-zinc-100"
                  }
                >
                  {duplicate ? t("Duplicate") : t("New")}
                </span>
              </TableCell>
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
