import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Student } from "@/pages/students/StudentForm";

function loadStudents(): Student[] {
  try {
    const parsed: Student[] = JSON.parse(
      localStorage.getItem("students") ?? "[]",
    );
    return parsed.map((s) => ({ ...s, training: s.training ?? "" }));
  } catch {
    return [];
  }
}

export default function StudentPickerPage() {
  const [students] = useState<Student[]>(loadStudents);
  const navigate = useNavigate();

  const handlePick = (id: string) => {
    localStorage.setItem("currentStudentId", id);
    navigate("/student");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">
            Choose Your Account
          </CardTitle>
          <CardDescription>
            Select the student you want to continue as for this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No students registered yet.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handlePick(s.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="text-sm font-medium">{s.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.program}
                    {s.training ? ` — ${s.training}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
