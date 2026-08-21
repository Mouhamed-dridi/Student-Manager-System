import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Program } from "@/lib/trainings";
import { PROGRAMS, TRAININGS } from "@/lib/trainings";
import StudentList from "./StudentList";
import type { Student } from "./StudentForm";

type ProgramFilter = Program | "all";

interface StudentListViewProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

export default function StudentListView({
  students,
  onEdit,
  onDelete,
}: StudentListViewProps) {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState<ProgramFilter>("all");
  const [training, setTraining] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasActiveFilters =
    search.trim() !== "" || program !== "all" || training !== "all";

  const trainingOptions =
    program === "all"
      ? [...new Set(Object.values(TRAININGS).flat())]
      : TRAININGS[program];

  const query = search.trim().toLowerCase();
  const filtered = students.filter((s) => {
    if (query && !s.fullName.toLowerCase().includes(query)) return false;
    if (program !== "all" && s.program !== program) return false;
    if (training !== "all" && s.training !== training) return false;
    return true;
  });

  const handleClear = () => {
    setSearch("");
    setProgram("all");
    setTraining("all");
  };

  return (
    <div className="space-y-3">
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
                  <Label>Program</Label>
                  <Select
                    value={program}
                    onValueChange={(value) => {
                      setProgram((value ?? "all") as ProgramFilter);
                      setTraining("all");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PROGRAMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Training</Label>
                  <Select
                    value={training}
                    onValueChange={(value) => setTraining(value ?? "all")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {trainingOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
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
            onClick={handleClear}
            className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {students.length > 0 && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students match your search or filters.
        </p>
      ) : (
        <StudentList students={filtered} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
