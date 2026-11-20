import { useMemo, useState } from "react";
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
import { useT } from "@/lib/i18n";
import TeacherList from "./TeacherList";
import type { Teacher } from "./TeacherForm";

interface TeacherListViewProps {
  teachers: Teacher[];
  onOpenProfile: (teacher: Teacher) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (id: string) => void;
}

export default function TeacherListView({
  teachers,
  onOpenProfile,
  onEdit,
  onDelete,
}: TeacherListViewProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const specialtyOptions = useMemo(
    () =>
      [
        ...new Set(
          teachers
            .map((teacher) => teacher.specialty)
            .filter((value) => value.trim() !== ""),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [teachers],
  );

  const hasActiveFilters =
    search.trim() !== "" || specialty !== "all";

  const query = search.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const filtered = teachers.filter((teacher) => {
    if (query) {
      const matchesName = teacher.fullName.toLowerCase().includes(query);
      const matchesSpecialty = (teacher.specialty ?? "")
        .toLowerCase()
        .includes(query);
      const matchesEmail = (teacher.email ?? "").toLowerCase().includes(query);
      const rawPhone = teacher.phone ?? "";
      const matchesPhone =
        rawPhone.toLowerCase().includes(query) ||
        (queryDigits.length > 0 &&
          rawPhone.replace(/\D/g, "").includes(queryDigits));
      if (
        !matchesName &&
        !matchesSpecialty &&
        !matchesEmail &&
        !matchesPhone
      )
        return false;
    }
    if (specialty !== "all" && teacher.specialty !== specialty) return false;
    return true;
  });

  const handleClear = () => {
    setSearch("");
    setSpecialty("all");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            placeholder={t("Search teachers...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("Search teachers...")}
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
                  <Label>{t("Specialty")}</Label>
                  <Select
                    value={specialty}
                    onValueChange={(value) => setSpecialty(value ?? "all")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("All")}</SelectItem>
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
            onClick={handleClear}
            className="cursor-pointer text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {teachers.length > 0 && filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("No teachers match your search or filters.")}
        </p>
      ) : (
        <TeacherList
          teachers={filtered}
          onOpenProfile={onOpenProfile}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
