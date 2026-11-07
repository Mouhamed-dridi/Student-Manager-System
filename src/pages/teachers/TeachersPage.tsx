import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  SegmentedTabsList,
  SegmentedTabsTrigger,
} from "@/components/ui/segmented-tabs";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  insertTeachers,
  listTeachers,
  softDeleteTeachers,
  subscribeToTable,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import TeacherProfilePage from "@/components/TeacherProfilePage";
import { DEFAULT_TEACHER_PASSWORD } from "@/pages/users/userAccounts";
import TeacherForm, { type Teacher } from "./TeacherForm";
import { parseTeacherFile, type ImportResult } from "./importTeachers";
import { exportTeachers } from "./exportTeachers";
import TeacherImportPreview from "./TeacherImportPreview";
import TeacherListView from "./TeacherListView";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  // The teacher whose full-page profile replaces the list (null = closed);
  // `edit` opens that profile with the edit sheet already up.
  const [profile, setProfile] = useState<{
    teacher: Teacher;
    edit?: boolean;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setTeachers(await listTeachers());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    listTeachers()
      .then(setTeachers)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Live updates: teachers added/edited/removed in another browser appear
  // here without a manual refresh.
  useEffect(
    () => subscribeToTable("teachers", () => void refresh()),
    [refresh],
  );

  // Quiet fallback: refetch once if the tab regains focus after a while.
  useRefetchOnFocus(refresh);

  // The profile is a sub-page of Teachers: registering it with the shared
  // history stack makes the header back arrow return to the list exactly like
  // the page's own "Back to teachers" button.
  useNestedView(
    profile !== null,
    "teacher-profile",
    "Teacher profile",
    () => setProfile(null),
  );

  // The full-page form now only creates teachers; editing happens in the
  // profile's right-side sheet.
  const handleSave = async (teacher: Teacher) => {
    try {
      setError(null);
      await insertTeachers([teacher]);
      setTeachers(await listTeachers());
    } catch (err) {
      setError(errorMessage(err));
    }
    setActiveTab("list");
    setImportSummary(null);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await softDeleteTeachers([id]);
      setTeachers(await listTeachers());
    } catch (err) {
      setError(errorMessage(err));
    }
    setImportSummary(null);
  };

  // The row's edit action opens the profile with its edit sheet already up,
  // replacing the old full-page edit form.
  const handleEdit = (teacher: Teacher) => {
    setProfile({ teacher, edit: true });
    setImportSummary(null);
  };

  const handleAddNew = () => {
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

  // Realtime refreshes replace the `teachers` rows: resolve the open profile by
  // id so the page always shows the latest record. The captured object is the
  // fallback for the frame where the row is gone (e.g. just soft-deleted).
  const profileTeacher = profile
    ? teachers?.find((t) => t.id === profile.teacher.id) ?? profile.teacher
    : null;

  if (profileTeacher) {
    return (
      <TeacherProfilePage
        teacher={profileTeacher}
        initialEditOpen={profile?.edit}
        onBack={() => setProfile(null)}
        // Saved in the sheet: refetch so the list row matches, without closing
        // the profile.
        onEdit={() => void refresh()}
      />
    );
  }

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
            <SegmentedTabsList>
              <SegmentedTabsTrigger value="list">Teacher List</SegmentedTabsTrigger>
              <SegmentedTabsTrigger value="add" onClick={handleAddNew}>
                Add Teacher
              </SegmentedTabsTrigger>
            </SegmentedTabsList>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (teachers && teachers.length > 0) exportTeachers(teachers);
              }}
              disabled={!teachers || teachers.length === 0}
            >
              <Download className="h-4 w-4" />
              Export Excel
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
              onOpenProfile={(teacher) => setProfile({ teacher })}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          {error && <DataError message={error} />}
          <TeacherForm
            key="new"
            onSave={handleSave}
            onCancel={() => setActiveTab("list")}
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
