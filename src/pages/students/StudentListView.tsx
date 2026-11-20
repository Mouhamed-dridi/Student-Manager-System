import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
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
import { useT } from "@/lib/i18n";
import StudentList from "./StudentList";
import { exportStudents } from "./exportStudents";
import type { Student } from "./StudentForm";

type ProgramFilter = Program | "all";

interface ProgramOption {
  id: string;
  code: string;
}

interface StudentListViewProps {
  students: Student[];
  onOpenProfile: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
}

export default function StudentListView({
  students,
  onOpenProfile,
  onEdit,
  onDelete,
  onDeleteMany,
}: StudentListViewProps) {
  const t = useT();
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
  const queryDigits = query.replace(/\D/g, "");
  const filtered = students.filter((s) => {
    if (query) {
      const matchesName = s.fullName.toLowerCase().includes(query);
      const matchesEmail = (s.email ?? "").toLowerCase().includes(query);
      const rawPhone = s.phone ?? "";
      const matchesPhone =
        rawPhone.toLowerCase().includes(query) ||
        (queryDigits.length > 0 &&
          rawPhone.replace(/\D/g, "").includes(queryDigits));
      if (!matchesName && !matchesEmail && !matchesPhone) return false;
    }
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

  const clearSelection = () => setSelectedIds(new Set());

  const handleExportSelected = () => {
    exportStudents(students.filter((s) => selectedIds.has(s.id)));
  };

  const deleteSelectedTitle =
    selectedIds.size === 1
      ? t("Delete 1 selected student?")
      : t("Delete {count} selected students?", { count: selectedIds.size });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            placeholder={t("Search students...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("Search students...")}
            className="h-8 border-zinc-200 bg-zinc-100/80 pl-8 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>

        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen((open) => !open)}
            className="border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("Filter")}
          </Button>

          {filtersOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setFiltersOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                <div className="space-y-1.5">
                  <Label>{t("Branch")}</Label>
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
                      <SelectItem value="all">{t("All")}</SelectItem>
                      {programOptions.map((p) => (
                        <SelectItem key={p.id} value={p.code}>
                          {p.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("Program")}</Label>
                  <Select
                    value={training}
                    onValueChange={(value) => setTraining(value ?? "all")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("All")}</SelectItem>
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
            className="cursor-pointer text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
          <span
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            role="status"
          >
            {t("{count} selected", { count: selectedIds.size })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportSelected}
              className="border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <Download className="h-4 w-4" />
              {t("Export selected")}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-200 bg-zinc-100/80 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    {t("Delete selected")}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{deleteSelectedTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "They will be moved to the Trash. You can restore them later or permanently delete from there.",
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onDeleteMany([...selectedIds]);
                      clearSelection();
                    }}
                    className="bg-zinc-900 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {t("Delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
              {t("Clear selection")}
            </Button>
          </div>
        </div>
      )}

      {students.length > 0 && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("No students match your search or filters.")}
        </p>
      ) : (
        <StudentList
          students={filtered}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onOpenProfile={onOpenProfile}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
