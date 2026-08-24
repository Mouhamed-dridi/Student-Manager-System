import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listStudents } from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

export default function MyClassPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled) return;
        if (!record) {
          setTeacher(null);
          return;
        }
        setTeacher(record);
        try {
          const all = await listStudents();
          if (cancelled) return;
          setRoster(
            all.filter(
              (s) => s.program === record.program && s.training === record.training,
            ),
          );
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || roster === null) {
    return <DataLoading label="Loading your class…" />;
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

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

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
