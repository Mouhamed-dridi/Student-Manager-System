import { useEffect, useMemo, useState } from "react";
import { Save, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Teacher } from "@/pages/teachers/TeacherForm";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

interface TeacherAttendanceProps {
  teachers: Teacher[];
}

export default function TeacherAttendance({
  teachers,
}: TeacherAttendanceProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<
    string,
    Record<string, boolean>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayString);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadAttendanceMap("teacher")
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
    setAttendanceMark("teacher", id, date, checked).catch((err) =>
      setError(errorMessage(err)),
    );
  };

  const handleSave = () => {
    // Marks are written to Supabase as they are toggled; this confirms it.
    setSaved(true);
  };

  const specialtyOptions = useMemo(
    () =>
      [
        ...new Set(teachers.map((t) => t.specialty).filter((s) => s.trim() !== "")),
      ].sort((a, b) => a.localeCompare(b)),
    [teachers],
  );

  const hasActiveFilters =
    search.trim() !== "" || specialty !== "all";

  const query = search.trim().toLowerCase();
  const filtered = teachers.filter((t) => {
    if (query && !t.fullName.toLowerCase().includes(query)) return false;
    if (specialty !== "all" && t.specialty !== specialty) return false;
    return true;
  });

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = Object.values(attendance).filter((v) => !v).length;
  const unmarkedCount = teachers.length - presentCount - absentCount;

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

        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by full name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </Button>

            {filtersOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFiltersOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-3 rounded-lg border bg-popover p-4 shadow-md">
                  <div className="space-y-1.5">
                    <Label>Specialty</Label>
                    <Select
                      value={specialty}
                      onValueChange={(value) => setSpecialty(value ?? "all")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {specialtyOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSpecialty("all");
              }}
              className="cursor-pointer whitespace-nowrap text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

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
      ) : teachers.length === 0 ? (
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
              <TableHead>Specialty</TableHead>
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
                  <TableCell>{t.specialty || "—"}</TableCell>
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
