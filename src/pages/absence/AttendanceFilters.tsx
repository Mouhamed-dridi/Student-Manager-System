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

export interface AttendanceFilterState {
  search: string;
  program: Program | "all";
  training: string;
}

interface AttendanceFiltersProps {
  value: AttendanceFilterState;
  onChange: (next: AttendanceFilterState) => void;
}

export default function AttendanceFilters({
  value,
  onChange,
}: AttendanceFiltersProps) {
  const [open, setOpen] = useState(false);
  const { search, program, training } = value;

  const hasActive =
    search.trim() !== "" || program !== "all" || training !== "all";

  const trainingOptions =
    program === "all"
      ? [...new Set(Object.values(TRAININGS).flat())]
      : TRAININGS[program];

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by full name..."
          value={search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="pl-8"
        />
      </div>

      <div className="relative">
        <Button variant="outline" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </Button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-3 rounded-lg border bg-popover p-4 shadow-md">
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select
                  value={program}
                  onValueChange={(v) =>
                    onChange({
                      ...value,
                      program: (v ?? "all") as Program | "all",
                      training: "all",
                    })
                  }
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
                  onValueChange={(v) =>
                    onChange({ ...value, training: v ?? "all" })
                  }
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

      {hasActive && (
        <button
          type="button"
          onClick={() =>
            onChange({ search: "", program: "all", training: "all" })
          }
          className="cursor-pointer whitespace-nowrap text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
