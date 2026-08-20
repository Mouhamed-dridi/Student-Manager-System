import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import StudentAttendance from "./StudentAttendance";
import TeacherAttendance from "./TeacherAttendance";

function loadStudents(): Student[] {
  try {
    return JSON.parse(localStorage.getItem("students") ?? "[]");
  } catch {
    return [];
  }
}

function loadTeachers(): Teacher[] {
  try {
    return JSON.parse(localStorage.getItem("teachers") ?? "[]");
  } catch {
    return [];
  }
}

export default function AbsencePage() {
  const [students] = useState<Student[]>(loadStudents);
  const [teachers] = useState<Teacher[]>(loadTeachers);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Attendance</h2>

      <Tabs defaultValue="students" className="mt-4">
        <TabsList>
          <TabsTrigger value="students">Student Attendance</TabsTrigger>
          <TabsTrigger value="teachers">Teacher Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <StudentAttendance students={students} />
        </TabsContent>

        <TabsContent value="teachers" className="mt-4">
          <TeacherAttendance teachers={teachers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
