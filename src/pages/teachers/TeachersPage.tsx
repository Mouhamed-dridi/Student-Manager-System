import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import {
  deleteTeachers,
  errorMessage,
  insertTeachers,
  listTeachers,
  updateTeacherProfile,
} from "@/lib/api";
import { DEFAULT_TEACHER_PASSWORD } from "@/pages/users/userAccounts";
import TeacherForm, { type Teacher } from "./TeacherForm";
import { parseTeacherFile, type ImportResult } from "./importTeachers";
import TeacherImportPreview from "./TeacherImportPreview";
import TeacherListView from "./TeacherListView";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listTeachers()
      .then(setTeachers)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const handleSave = async (teacher: Teacher) => {
    try {
      setError(null);
      if (teachers?.some((t) => t.id === teacher.id)) {
        // Form fields don't carry login data — the API update only touches
        // profile fields, so login data is preserved across edits.
        await updateTeacherProfile(teacher.id, teacher);
      } else {
        await insertTeachers([teacher]);
      }
      setTeachers(await listTeachers());
    } catch (err) {
      setError(errorMessage(err));
    }
    setEditingTeacher(null);
    setActiveTab("list");
    setImportSummary(null);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteTeachers([id]);
      setTeachers(await listTeachers());
    } catch (err) {
      setError(errorMessage(err));
    }
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

    const current = teachers ?? [];
    const result = await parseTeacherFile(
      file,
      current.map((t) => t.email),
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

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    // Imported teachers start with the default login password.
    const imported = pendingImport.rows
      .filter((r) => !r.duplicate)
      .map((r) => ({ ...r.teacher, password: DEFAULT_TEACHER_PASSWORD }));
    const duplicates = pendingImport.rows.filter((r) => r.duplicate).length;
    const missing = pendingImport.missingData;

    try {
      setError(null);
      await insertTeachers(imported);
      setTeachers(await listTeachers());

      const summary: string[] = [
        `Added ${imported.length} teacher${imported.length === 1 ? "" : "s"}`,
      ];
      if (duplicates > 0)
        summary.push(`skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}`);
      if (missing > 0)
        summary.push(`skipped ${missing} row${missing === 1 ? "" : "s"} with missing data`);
      setImportSummary(summary.join(", ") + ".");
    } catch (err) {
      setError(errorMessage(err));
    }
    setPendingImport(null);
    setActiveTab("list");
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
          {error && <DataError message={error} />}
          {importSummary && (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              {importSummary}
            </p>
          )}
          {teachers === null ? (
            <DataLoading label="Loading teachers…" />
          ) : (
            <TeacherListView
              teachers={teachers}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          {error && <DataError message={error} />}
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
