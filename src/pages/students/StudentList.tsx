import { Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/UserAvatar";
import { formatPhone } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useUserProfiles } from "@/lib/userProfile";
import type { Student } from "./StudentForm";

interface StudentListProps {
  students: Student[];
  selectedIds: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpenProfile: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

export default function StudentList({
  students,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onOpenProfile,
  onEdit,
  onDelete,
}: StudentListProps) {
  const t = useT();
  // One request for the whole list (`user_profiles` is the only home of the
  // photo); a row whose person never uploaded one falls back to initials.
  const profiles = useUserProfiles("student");

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("No students registered yet.")}
      </p>
    );
  }

  const allSelected = students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id));

  return (
    <Table>
      <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={() => onToggleAll()}
                aria-label={t("Select all visible students")}
              />
            </TableHead>
            <TableHead>{t("Full Name")}</TableHead>
            <TableHead>{t("Branch")}</TableHead>
            <TableHead>{t("Program")}</TableHead>
            <TableHead>{t("Phone")}</TableHead>
            <TableHead>{t("Email")}</TableHead>
            <TableHead className="w-24">{t("Actions")}</TableHead>
          </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => {
          const selected = selectedIds.has(s.id);
          const phone = formatPhone(s.phone ?? "");
          return (
            <TableRow
              key={s.id}
              data-selected={selected}
              onClick={() => onOpenProfile(s)}
              className="cursor-pointer data-[selected=true]:bg-zinc-50 dark:data-[selected=true]:bg-zinc-900/40"
            >
              {/* The checkbox and the actions own their clicks: selecting or
                  deleting a row must not also open the profile. */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleRow(s.id)}
                  aria-label={t("Select {name}", { name: s.fullName })}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    name={s.fullName}
                    src={profiles.get(s.id)?.avatarUrl}
                    fallback="S"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile(s);
                    }}
                    className="cursor-pointer text-left hover:underline"
                  >
                    {s.fullName}
                  </button>
                </div>
              </TableCell>
              <TableCell>
                {s.program ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-zinc-200">
                    {s.program}
                  </span>
                ) : (
                  <span className="text-zinc-500">{t("Unassigned")}</span>
                )}
              </TableCell>
              <TableCell>
                {s.training ? (
                  s.training
                ) : (
                  <span className="text-zinc-500">{t("Unassigned")}</span>
                )}
              </TableCell>
              <TableCell>{phone}</TableCell>
            <TableCell>{s.email}</TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(s)}
                  aria-label={t("Edit student")}
                  className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("Delete student")}
                        className="text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Delete student?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t(
                          "{name} will be moved to the Trash. You can restore them later or permanently delete from there.",
                          { name: s.fullName },
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(s.id)}
                        className="bg-zinc-900 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        {t("Delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
