import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentForm, { type Student } from "./StudentForm";
import { parseStudentFile, type ImportResult } from "./importStudents";
import StudentImportPreview from "./StudentImportPreview";
import StudentListView from "./StudentListView";

const STORAGE_KEY = "students";

function loadStudents(): Student[] {
  try {
    const parsed: Student[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return parsed.map((s) => ({ ...s, training: s.training ?? "" }));
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
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveStudents(students);
  }, [students]);

  const handleSave = (student: Student) => {
    setStudents((prev) => {
      const exists = prev.findIndex((s) => s.id === student.id);
      if (exists >= 0) {
        // Form fields don't carry login data — preserve it across edits.
        const updated = [...prev];
        updated[exists] = { ...prev[exists], ...student };
        return updated;
      }
      return [...prev, student];
    });
    setEditingStudent(null);
    setActiveTab("list");
    setImportSummary(null);
  };

  const handleDelete = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setImportSummary(null);
  };

  // One state update — the persistence effect writes localStorage once.
  const handleDeleteMany = (ids: string[]) => {
    setStudents((prev) => prev.filter((s) => !ids.includes(s.id)));
    setImportSummary(null);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setActiveTab("add");
    setImportSummary(null);
  };

  const handleAddNew = () => {
    setEditingStudent(null);
    setActiveTab("add");
    setImportSummary(null);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await parseStudentFile(file);
    if (result.students.length === 0) {
      setPendingImport(null);
      setActiveTab("list");
      setImportSummary("No valid rows found in the selected file.");
      return;
    }
    setPendingImport(result);
    setActiveTab("import");
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const { students: imported, skipped } = pendingImport;
    setStudents((prev) => [...prev, ...imported]);
    setPendingImport(null);
    setActiveTab("list");
    setImportSummary(
      skipped > 0
        ? `Imported ${imported.length} student${imported.length === 1 ? "" : "s"}, skipped ${skipped} row${skipped === 1 ? "" : "s"} with missing or invalid data.`
        : `Imported ${imported.length} student${imported.length === 1 ? "" : "s"}.`,
    );
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setActiveTab("list");
  };

  return (
    <div>
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setPendingImport(null);
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Students</h2>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="list">Student List</TabsTrigger>
              <TabsTrigger value="add" onClick={handleAddNew}>
                Add Student
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <TabsContent value="list" className="mt-4 space-y-3">
          {importSummary && (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              {importSummary}
            </p>
          )}
          <StudentListView
            students={students}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDeleteMany={handleDeleteMany}
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

        <TabsContent value="import" className="mt-4">
          {pendingImport && (
            <StudentImportPreview
              rows={pendingImport.students}
              skipped={pendingImport.skipped}
              onConfirm={handleConfirmImport}
              onCancel={handleCancelImport}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
