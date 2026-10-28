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
  if (teachers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No teachers registered yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Full Name</TableHead>
          <TableHead>Specialty</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teachers.map((t) => (
          <TableRow
            key={t.id}
            onClick={() => onOpenProfile(t)}
            className="cursor-pointer"
          >
            {/* The actions own their clicks: editing or deleting a row must
                not also open the profile. */}
            <TableCell className="font-medium">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProfile(t);
                }}
                className="cursor-pointer text-left hover:underline"
              >
                {t.fullName}
              </button>
            </TableCell>
            <TableCell>{t.specialty || "—"}</TableCell>
            <TableCell>{t.phone}</TableCell>
            <TableCell>{t.email}</TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(t)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.fullName} will be moved to the Trash. You can
                        restore them later or permanently delete from there.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(t.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
