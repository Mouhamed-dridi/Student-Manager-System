import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function MyInfoPage() {
  const [student] = useState<Student | null>(loadCurrentStudent);

  if (!student) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">My Info</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">My Info</h2>

      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <CardTitle>{student.fullName}</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator />
          <InfoRow label="Program" value={student.program} />
          <Separator />
          <InfoRow label="Training" value={student.training || "—"} />
          <Separator />
          <InfoRow label="Phone Number" value={student.phone || "—"} />
          <Separator />
          <InfoRow label="Email" value={student.email || "—"} />
        </CardContent>
      </Card>
    </div>
  );
}
