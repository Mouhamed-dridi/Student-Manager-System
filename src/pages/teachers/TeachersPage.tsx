import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeacherForm, { type Teacher } from "./TeacherForm";
import TeacherList from "./TeacherList";

const STORAGE_KEY = "teachers";

function loadTeachers(): Teacher[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTeachers(teachers: Teacher[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teachers));
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(loadTeachers);
  const [activeTab, setActiveTab] = useState("list");
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    saveTeachers(teachers);
  }, [teachers]);

  const handleSave = (teacher: Teacher) => {
    setTeachers((prev) => {
      const exists = prev.findIndex((t) => t.id === teacher.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = teacher;
        return updated;
      }
      return [...prev, teacher];
    });
    setEditingTeacher(null);
    setActiveTab("list");
  };

  const handleDelete = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setActiveTab("add");
  };

  const handleAddNew = () => {
    setEditingTeacher(null);
    setActiveTab("add");
  };

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Teachers</h2>
          <TabsList>
            <TabsTrigger value="list">Teacher List</TabsTrigger>
            <TabsTrigger value="add" onClick={handleAddNew}>
              Add Teacher
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-4">
          <TeacherList
            teachers={teachers}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <TeacherForm
            key={editingTeacher?.id ?? "new"}
            initialData={editingTeacher ?? undefined}
            onSave={handleSave}
            onCancel={() => {
              setEditingTeacher(null);
              setActiveTab("list");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
