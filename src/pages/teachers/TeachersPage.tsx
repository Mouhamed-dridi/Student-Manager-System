import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeacherForm, { type Teacher } from "./TeacherForm";
import TeacherList from "./TeacherList";
import { parseTeacherFile, type ImportResult } from "./importTeachers";
import TeacherImportPreview from "./TeacherImportPreview";

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
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setImportSummary(null);
  };

  const handleDelete = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setImportSummary(null);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setActiveTab("add");
    setImportSummary(null);
  };

  const handleAddNew = () => {
    setEditingTeacher(null);
    setActiveTab("add");
    setImportSummary(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const result = await parseTeacherFile(
      file,
      teachers.map((t) => t.email),
    );
    const newCount = result.rows.filter((r) => !r.duplicate).length;

    if (newCount === 0 && result.rows.length === 0 && result.missingData === 0) {
      setPendingImport(null);
      setActiveTab("list");
      setImportSummary("The selected file contains no teacher rows.");
      return;
    }

    if (newCount === 0) {
      const parts: string[] = ["Nothing new to import:"];
      const duplicates = result.rows.length;
      if (duplicates > 0)
        parts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"}`);
      if (result.missingData > 0)
        parts.push(
          `${result.missingData} row${result.missingData === 1 ? "" : "s"} with missing data`,
        );
      setPendingImport(null);
      setActiveTab("list");
      setImportSummary(parts.join(", ") + ".");
      return;
    }

    setPendingImport(result);
    setActiveTab("import");
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const imported = pendingImport.rows
      .filter((r) => !r.duplicate)
      .map((r) => r.teacher);
    const duplicates = pendingImport.rows.filter((r) => r.duplicate).length;
    const missing = pendingImport.missingData;

    setTeachers((prev) => [...prev, ...imported]);
    setPendingImport(null);
    setActiveTab("list");

    const summary: string[] = [
      `Added ${imported.length} teacher${imported.length === 1 ? "" : "s"}`,
    ];
    if (duplicates > 0)
      summary.push(`skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}`);
    if (missing > 0)
      summary.push(`skipped ${missing} row${missing === 1 ? "" : "s"} with missing data`);
    setImportSummary(summary.join(", ") + ".");
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
          <h2 className="text-2xl font-semibold">Teachers</h2>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="list">Teacher List</TabsTrigger>
              <TabsTrigger value="add" onClick={handleAddNew}>
                Add Teacher
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

        <TabsContent value="import" className="mt-4">
          {pendingImport && (
            <TeacherImportPreview
              rows={pendingImport.rows}
              missingData={pendingImport.missingData}
              onConfirm={handleConfirmImport}
              onCancel={handleCancelImport}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
