import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import UserAvatar from "@/components/UserAvatar";
import { formatPersonName, formatPhone } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useUserProfiles } from "@/lib/userProfile";
import type { Teacher } from "./TeacherForm";

interface TeacherListProps {
  teachers: Teacher[];
  onOpenProfile: (teacher: Teacher) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string) => void;
}

export default function TeacherList({
  teachers,
  onOpenProfile,
  onEdit,
  onDelete,
}: TeacherListProps) {
  const t = useT();
  // One request for the whole list; the photo lives in `user_profiles` and a
  // teacher without one keeps the initials badge.
  const profiles = useUserProfiles("teacher");

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("No teachers registered yet.")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200 hover:bg-transparent dark:border-zinc-800">
            <TableHead>{t("Full Name")}</TableHead>
            <TableHead>{t("Specialty")}</TableHead>
            <TableHead>{t("Phone")}</TableHead>
            <TableHead>{t("Email")}</TableHead>
            <TableHead className="w-24">{t("Actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => {
            const fullName = formatPersonName(teacher.fullName);
            const phone = formatPhone(teacher.phone ?? "");
            return (
              <TableRow
                key={teacher.id}
                onClick={() => onOpenProfile(teacher)}
                className="cursor-pointer border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                {/* The actions own their clicks: editing or deleting a row must
                    not also open the profile. */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      name={teacher.fullName}
                      src={profiles.get(teacher.id)?.avatarUrl ?? teacher.avatarUrl}
                      fallback="T"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(teacher);
                      }}
                      className="cursor-pointer text-left hover:underline"
                    >
                      {fullName}
                    </button>
                  </div>
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
                <TableCell>{phone}</TableCell>
                <TableCell>{teacher.email}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(teacher)}
                      aria-label={t("Edit teacher")}
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
                            aria-label={t("Delete teacher")}
                            className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("Delete teacher?")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t(
                              "{name} will be moved to the Trash. You can restore them later or permanently delete from there.",
                              { name: fullName },
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(teacher.id)}
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
    </div>
  );
}
