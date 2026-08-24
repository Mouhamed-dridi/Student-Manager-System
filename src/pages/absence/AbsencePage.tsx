import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listStudents, listTeachers } from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import StudentAttendance from "./StudentAttendance";
import TeacherAttendance from "./TeacherAttendance";

export default function AbsencePage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listStudents(), listTeachers()])
      .then(([nextStudents, nextTeachers]) => {
        setStudents(nextStudents);
        setTeachers(nextTeachers);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Attendance</h2>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {students === null || teachers === null ? (
        <div className="mt-4">
          <DataLoading label="Loading people…" />
        </div>
      ) : (
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
      )}
    </div>
  );
}
