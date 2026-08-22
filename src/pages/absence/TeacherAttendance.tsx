import { useState } from "react";
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
import type { Teacher } from "@/pages/teachers/TeacherForm";
import AttendanceFilters, {
  type AttendanceFilterState,
} from "./AttendanceFilters";

const STORAGE_KEY = "teacherAttendance";

function loadAttendanceMap(): Record<string, Record<string, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveAttendanceMap(map: Record<string, Record<string, boolean>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

interface TeacherAttendanceProps {
  teachers: Teacher[];
}

export default function TeacherAttendance({
  teachers,
}: TeacherAttendanceProps) {
  const [attendanceMap, setAttendanceMap] = useState(loadAttendanceMap);
  const [date, setDate] = useState(todayString);
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState<AttendanceFilterState>({
    search: "",
    program: "all",
    training: "all",
  });

  // Only explicitly marked people count; an unsaved day starts all unmarked.
  const attendance = attendanceMap[date] ?? {};

  const handleToggle = (id: string, checked: boolean) => {
    const updated = {
      ...attendanceMap,
      [date]: { ...attendanceMap[date], [id]: checked },
    };
    setAttendanceMap(updated);
    saveAttendanceMap(updated);
    setSaved(false);
  };

  const handleSave = () => {
    saveAttendanceMap(attendanceMap);
    setSaved(true);
  };

  const query = filters.search.trim().toLowerCase();
  const filtered = teachers.filter((t) => {
    if (query && !t.fullName.toLowerCase().includes(query)) return false;
    if (filters.program !== "all" && t.program !== filters.program)
      return false;
    if (filters.training !== "all" && t.training !== filters.training)
      return false;
    return true;
  });

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = Object.values(attendance).filter((v) => !v).length;
  const unmarkedCount = teachers.length - presentCount - absentCount;

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

      {teachers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teachers registered yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teachers match your search or filters.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Training</TableHead>
              <TableHead className="w-32 text-center">Present</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const isPresent = attendance[t.id] === true;
              const isAbsent = attendance[t.id] === false;
              return (
                <TableRow
                  key={t.id}
                  className={isAbsent ? "text-muted-foreground" : ""}
                >
                  <TableCell className={isAbsent ? "line-through" : ""}>
                    {t.fullName}
                  </TableCell>
                  <TableCell>{t.program}</TableCell>
                  <TableCell>{t.training}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={isPresent}
                      onCheckedChange={(checked) =>
                        handleToggle(t.id, checked)
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
