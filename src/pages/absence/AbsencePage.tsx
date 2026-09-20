import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  errorMessage,
  insertAttendanceRecords,
  loadAttendanceRecords,
  type AttendanceRecord,
} from "@/lib/api";
import AttendanceLog from "./AttendanceLog";
import AddAbsenceDialog from "./AddAbsenceDialog";
import { parseAttendanceFile } from "./importAttendance";
import { exportAttendance } from "./exportAttendance";

export default function AbsencePage() {
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await loadAttendanceRecords();
      setRecords(rows);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadAttendanceRecords()
      .then((rows) => {
        setRecords(rows);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const handleAddSaved = () => {
    setSummary(null);
    void refresh();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const result = await parseAttendanceFile(file);
    if (result.records.length === 0) {
      setSummary(
        "No valid attendance rows found in the selected file. Expected columns: Type, Full Name, Date (Class Name and Time optional).",
      );
      return;
    }

    try {
      setError(null);
      await insertAttendanceRecords(result.records);
      await refresh();
      setSummary(
        `Imported ${result.records.length} record${result.records.length === 1 ? "" : "s"}${result.skipped > 0 ? `, skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"} with missing or invalid data` : ""}.`,
      );
    } catch (err) {
      setError(errorMessage(err));
      setSummary(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Attendance</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Absence
          </Button>
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
              if (records && records.length > 0) exportAttendance(records);
            }}
            disabled={!records || records.length === 0}
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

      {summary && (
        <p className="mt-4 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          {summary}
        </p>
      )}

      <div className="mt-4">
        <AttendanceLog
          records={records}
          error={error}
          loading={records === null && !error}
        />
      </div>

      {addOpen && (
        <AddAbsenceDialog
          onSaved={handleAddSaved}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}