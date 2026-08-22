import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentTeacher } from "./currentTeacher";

function loadRoster(program: string, training: string): Student[] {
  try {
    const students: Student[] = JSON.parse(
      localStorage.getItem("students") ?? "[]",
    );
    return students.filter(
      (s) => s.program === program && s.training === training,
    );
  } catch {
    return [];
  }
}

export default function MyClassPage() {
  const [teacher] = useState(loadCurrentTeacher);
  const [roster] = useState(() =>
    teacher ? loadRoster(teacher.program, teacher.training) : [],
  );

  if (!teacher) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  const sorted = [...roster].sort((a, b) =>
    (a.fullName ?? "").localeCompare(b.fullName ?? ""),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Class</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {sorted.length} student{sorted.length === 1 ? "" : "s"} in{" "}
        {teacher.training || "—"} ({teacher.program})
      </p>

      {sorted.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No students yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Students appear here once they are assigned to your program and
              training.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.fullName}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>{s.email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
