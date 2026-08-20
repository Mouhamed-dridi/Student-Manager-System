import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentForm, { type Student } from "./StudentForm";
import StudentList from "./StudentList";

const STORAGE_KEY = "students";

function loadStudents(): Student[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(loadStudents);
  const [activeTab, setActiveTab] = useState("list");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  useEffect(() => {
    saveStudents(students);
  }, [students]);

  const handleSave = (student: Student) => {
    setStudents((prev) => {
      const exists = prev.findIndex((s) => s.id === student.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = student;
        return updated;
      }
      return [...prev, student];
    });
    setEditingStudent(null);
    setActiveTab("list");
  };

  const handleDelete = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setActiveTab("add");
  };

  const handleAddNew = () => {
    setEditingStudent(null);
    setActiveTab("add");
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Students</h2>
          <TabsList>
            <TabsTrigger value="list">Student List</TabsTrigger>
            <TabsTrigger value="add" onClick={handleAddNew}>
              Add Student
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-4">
          <StudentList
            students={students}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <StudentForm
            key={editingStudent?.id ?? "new"}
            initialData={editingStudent ?? undefined}
            onSave={handleSave}
            onCancel={() => {
              setEditingStudent(null);
              setActiveTab("list");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
