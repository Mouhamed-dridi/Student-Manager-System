import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { listPrograms, listTrainings } from "@/lib/api";
import StudentList from "./StudentList";
import type { Student } from "./StudentForm";

type ProgramFilter = Program | "all";

interface ProgramOption {
  id: string;
  code: string;
}

interface StudentListViewProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
}

export default function StudentListView({
  students,
  onEdit,
  onDelete,
  onDeleteMany,
}: StudentListViewProps) {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState<ProgramFilter>("all");
  const [training, setTraining] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [allTrainings, setAllTrainings] = useState<
    { name: string; programId: string }[]
  >([]);

  useEffect(() => {
    listPrograms().then(setProgramOptions).catch(() => {});
    listTrainings().then((rows) => {
      setAllTrainings(rows.map((r) => ({ name: r.name, programId: r.program_id })));
    }).catch(() => {});
  }, []);

  const trainingOptions = useMemo(() => {
    if (program === "all") {
      return [...new Set(allTrainings.map((t) => t.name))];
    }
    const selectedProgramId = programOptions.find((p) => p.code === program)?.id;
    if (!selectedProgramId) return [];
    return allTrainings
      .filter((t) => t.programId === selectedProgramId)
      .map((t) => t.name);
  }, [program, programOptions, allTrainings]);

  const hasActiveFilters =
    search.trim() !== "" || program !== "all" || training !== "all";

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

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select-all is scoped to the currently visible (filtered) rows only.
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = filtered.every((s) => next.has(s.id));
      for (const s of filtered) {
        if (allVisibleSelected) {
          next.delete(s.id);
        } else {
          next.add(s.id);
        }
      }
      return next;
    });
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
                      {programOptions.map((p) => (
                        <SelectItem key={p.id} value={p.code}>
                          {p.code}
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
                      {trainingOptions.map((name) => (
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
        <>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium">
                {selectedIds.size} student
                {selectedIds.size === 1 ? "" : "s"} selected
              </span>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                      Delete Selected
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedIds.size} selected student
                      {selectedIds.size === 1 ? "" : "s"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They will be moved to the Trash. You can restore them
                      later or permanently delete from there.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDeleteMany([...selectedIds]);
                        setSelectedIds(new Set());
                      }}
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          <StudentList
            students={filtered}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </>
      )}
    </div>
  );
}
