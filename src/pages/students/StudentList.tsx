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
import type { Student } from "./StudentForm";

interface StudentListProps {
  students: Student[];
  selectedIds: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

export default function StudentList({
  students,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onEdit,
  onDelete,
}: StudentListProps) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No students registered yet.
      </p>
    );
  }

  const allSelected = students.every((s) => selectedIds.has(s.id));

  return (
    <Table>
      <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => onToggleAll()}
                aria-label="Select all visible students"
              />
            </TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Training</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
            <TableRow key={s.id} data-selected={selectedIds.has(s.id)}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(s.id)}
                  onCheckedChange={() => onToggleRow(s.id)}
                  aria-label={`Select ${s.fullName}`}
                />
              </TableCell>
              <TableCell>{s.fullName}</TableCell>
              <TableCell>{s.program}</TableCell>
              <TableCell>{s.training}</TableCell>
              <TableCell>{s.phone}</TableCell>
            <TableCell>{s.email}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(s)}
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
                      <AlertDialogTitle>Delete student?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove {s.fullName} from the
                        list. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(s.id)}>
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
