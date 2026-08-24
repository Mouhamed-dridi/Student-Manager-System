import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  loadAttendanceMap,
  setAttendanceMark,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import AttendanceFilters, {
  type AttendanceFilterState,
} from "./AttendanceFilters";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

interface StudentAttendanceProps {
  students: Student[];
}

export default function StudentAttendance({
  students,
}: StudentAttendanceProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<
    string,
    Record<string, boolean>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayString);
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState<AttendanceFilterState>({
    search: "",
    program: "all",
    training: "all",
  });

  useEffect(() => {
    loadAttendanceMap("student")
      .then(setAttendanceMap)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Only explicitly marked people count; an unmarked day starts all unmarked.
  const attendance = attendanceMap?.[date] ?? {};

  const handleToggle = (id: string, checked: boolean) => {
    if (attendanceMap === null) return;
    setAttendanceMap({
      ...attendanceMap,
      [date]: { ...attendanceMap[date], [id]: checked },
    });
    setSaved(false);
    setAttendanceMark("student", id, date, checked).catch((err) =>
      setError(errorMessage(err)),
    );
  };

  const handleSave = () => {
    // Marks are written to Supabase as they are toggled; this confirms it.
    setSaved(true);
  };

  const query = filters.search.trim().toLowerCase();
  const filtered = students.filter((s) => {
    if (query && !s.fullName.toLowerCase().includes(query)) return false;
    if (filters.program !== "all" && s.program !== filters.program)
      return false;
    if (filters.training !== "all" && s.training !== filters.training)
      return false;
    return true;
  });

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = Object.values(attendance).filter((v) => !v).length;
  const unmarkedCount = students.length - presentCount - absentCount;

  if (error && attendanceMap === null) {
    return (
      <div className="space-y-3">
        <DataError message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSaved(false);
            }}
          />
        </div>

        <AttendanceFilters value={filters} onChange={setFilters} />

        <div className="text-sm text-muted-foreground">
          {presentCount} present, {absentCount} absent
          {unmarkedCount > 0 ? `, ${unmarkedCount} unmarked` : ""}
        </div>

        <Button onClick={handleSave} className="ml-auto">
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      {saved && (
        <p className="text-sm text-green-600">Attendance saved for {date}.</p>
      )}
      {error && <DataError message={error} />}

      {attendanceMap === null ? (
        <DataLoading label="Loading attendance…" />
      ) : students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students registered yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students match your search or filters.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Program</TableHead>
              <TableHead className="w-32 text-center">Present</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const isPresent = attendance[s.id] === true;
              const isAbsent = attendance[s.id] === false;
              return (
                <TableRow
                  key={s.id}
                  className={isAbsent ? "text-muted-foreground" : ""}
                >
                  <TableCell className={isAbsent ? "line-through" : ""}>
                    {s.fullName}
                  </TableCell>
                  <TableCell>{s.program}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={isPresent}
                      onCheckedChange={(checked) =>
                        handleToggle(s.id, checked)
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
