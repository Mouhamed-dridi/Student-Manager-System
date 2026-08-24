import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import {
  deleteStudents,
  errorMessage,
  insertStudents,
  listStudents,
  subscribeToTable,
  updateStudentProfile,
} from "@/lib/api";
import { DEFAULT_STUDENT_PASSWORD } from "@/pages/users/userAccounts";
import StudentForm, { type Student } from "./StudentForm";
import { parseStudentFile, type ImportResult } from "./importStudents";
import StudentImportPreview from "./StudentImportPreview";
import StudentListView from "./StudentListView";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setStudents(await listStudents());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Live updates: students added/edited/removed in another browser
  // (e.g. by the operator) appear here without a manual refresh.
  useEffect(
    () => subscribeToTable("students", () => void refresh()),
    [refresh],
  );

  const handleSave = async (student: Student) => {
    try {
      setError(null);
      if (students?.some((s) => s.id === student.id)) {
        // Form fields don't carry login data — the API update only touches
        // profile fields, so login data is preserved across edits.
        await updateStudentProfile(student.id, student);
      } else {
        await insertStudents([student]);
      }
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
    setEditingStudent(null);
    setActiveTab("list");
    setImportSummary(null);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await deleteStudents([id]);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
    setImportSummary(null);
  };

  const handleDeleteMany = async (ids: string[]) => {
    try {
      setError(null);
      await deleteStudents(ids);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
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

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { students: imported, skipped } = pendingImport;
    // Imported students start with the default login password.
    const withLogins = imported.map((s) => ({
      ...s,
      password: DEFAULT_STUDENT_PASSWORD,
    }));
    try {
      setError(null);
      await insertStudents(withLogins);
      await refresh();
      setImportSummary(
        skipped > 0
          ? `Imported ${withLogins.length} student${withLogins.length === 1 ? "" : "s"}, skipped ${skipped} row${skipped === 1 ? "" : "s"} with missing or invalid data.`
          : `Imported ${withLogins.length} student${withLogins.length === 1 ? "" : "s"}.`,
      );
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
          {error && <DataError message={error} />}
          {importSummary && (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              {importSummary}
            </p>
          )}
          {students === null ? (
            <DataLoading label="Loading students…" />
          ) : (
            <StudentListView
              students={students}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeleteMany={handleDeleteMany}
            />
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          {error && <DataError message={error} />}
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
