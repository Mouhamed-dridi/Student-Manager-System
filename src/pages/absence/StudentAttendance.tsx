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
import type { Student } from "@/pages/students/StudentForm";

const STORAGE_KEY = "studentAttendance";

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

function getDayAttendance(
  map: Record<string, Record<string, boolean>>,
  date: string,
  studentIds: string[]
): Record<string, boolean> {
  if (map[date]) return map[date];
  const all: Record<string, boolean> = {};
  for (const id of studentIds) {
    all[id] = true;
  }
  return all;
}

interface StudentAttendanceProps {
  students: Student[];
}

export default function StudentAttendance({ students }: StudentAttendanceProps) {
  const [attendanceMap, setAttendanceMap] = useState(loadAttendanceMap);
  const [date, setDate] = useState(todayString);
  const [saved, setSaved] = useState(false);

  const studentIds = students.map((s) => s.id);
  const attendance = getDayAttendance(attendanceMap, date, studentIds);

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

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = students.length - presentCount;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
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
        <div className="text-sm text-muted-foreground">
          {presentCount} present, {absentCount} absent
        </div>
        <Button onClick={handleSave} className="ml-auto">
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      {saved && (
        <p className="text-sm text-green-600">Attendance saved for {date}.</p>
      )}

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students registered yet.
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
            {students.map((s) => {
              const isPresent = attendance[s.id] !== false;
              return (
                <TableRow
                  key={s.id}
                  className={isPresent ? "" : "text-muted-foreground"}
                >
                  <TableCell
                    className={isPresent ? "" : "line-through"}
                  >
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
