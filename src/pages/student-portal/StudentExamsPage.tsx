import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, Filter, Timer } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  classNameFor,
  errorMessage,
  listExamsForStudentClass,
  type StudentExamEntry,
} from "@/lib/api";
import { subjectAliasKey, subjectNamesMatch } from "@/lib/courseDisplay";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Student } from "@/pages/students/StudentForm";
import { loadCurrentStudent } from "./currentStudent";
import { dateKeyOf, formatLongDate } from "./scheduleDates";

function ExamCard({ exam }: { exam: StudentExamEntry }) {
  const details = [exam.type, exam.duration, exam.semester].filter(Boolean);
  return (
    <article className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{exam.title}</h3>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium">
          {exam.duration || "—"}
        </span>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {formatLongDate(exam.date)}
      </p>

      {exam.materials.length > 0 && (
        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
          {exam.materials.join(" · ")}
        </p>
      )}

      {details.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {details.map((detail) => (
            <span
              key={detail}
              className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            >
              {detail}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-3">
        {exam.attachmentUrl ? (
          <a
            href={exam.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            {exam.attachment || "Download exam file"}
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            No file attached
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Exams for the student's class. `exams` only carries program/training text
 * snapshots, so the feed is resolved in the API: class snapshot matches plus
 * every exam published by a teacher assigned to this branch in
 * `branch_materials` (the transverse English/Français/logistics modules).
 *
 * The matière filter mirrors the Courses page: "All subjects" is pinned first
 * with the total, then every class material with its exam count — including
 * the ones that have none yet.
 */
export default function StudentExamsPage() {
  const { t } = useI18n();
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [exams, setExams] = useState<StudentExamEntry[]>([]);
  // The class's matières, branch catalog + distinct exam subjects.
  const [materials, setMaterials] = useState<string[]>([]);
  // Alias-folded matière key; "all" shows every exam.
  const [subject, setSubject] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Promise chain (not async/await) to match MyAttendancePage: every setState
  // lands in a callback, so it never runs synchronously inside the effect.
  const load = useCallback(() => {
    return loadCurrentStudent()
      .then(async (record) => {
        setError(null);
        setStudent(record);
        if (!record) {
          setExams([]);
          setMaterials([]);
          return;
        }
        const feed = await listExamsForStudentClass({
          program: record.program?.trim() ?? "",
          training: record.training?.trim() ?? "",
          programId: record.programId,
          trainingId: record.trainingId,
        });
        setMaterials(feed.materials);
        setExams(feed.exams);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefetchOnFocus(load);

  const todayKey = dateKeyOf(new Date());

  // A matière that disappears (material deleted, class changed) must not leave
  // the page stuck on an empty filter; derive the active key during render.
  const activeSubject = materials.some(
    (name) => subjectAliasKey(name) === subject,
  )
    ? subject
    : "all";

  const subjectOptions = useMemo(() => {
    return [
      { value: "all", label: t("All subjects"), count: exams.length },
      ...materials.map((name) => ({
        value: subjectAliasKey(name),
        label: name,
        count: exams.filter((exam) =>
          exam.materials.some((material) =>
            subjectNamesMatch(material, name),
          ),
        ).length,
      })),
    ];
  }, [exams, materials, t]);

  const selectItems = useMemo(
    () => subjectOptions.map(({ value, label }) => ({ value, label })),
    [subjectOptions],
  );

  const filteredExams = useMemo(() => {
    if (activeSubject === "all") return exams;
    return exams.filter((exam) =>
      exam.materials.some((material) =>
        subjectNamesMatch(material, activeSubject),
      ),
    );
  }, [exams, activeSubject]);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...filteredExams].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    return {
      upcoming: sorted.filter((exam) => exam.date >= todayKey),
      past: sorted.filter((exam) => exam.date < todayKey).reverse(),
    };
  }, [filteredExams, todayKey]);

  const classLabel = student
    ? classNameFor(student.program, student.training)
    : "";

  if (student === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Exams</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  const activeSubjectLabel =
    subjectOptions.find((option) => option.value === activeSubject)?.label ??
    "";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Exams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {classLabel || "Your class"} · upcoming and past exams
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            {filteredExams.length} exam{filteredExams.length === 1 ? "" : "s"}
          </span>

          {/* Matière filter — beside the counter, opening downward so it never
              overlaps the top navbar. Every class material is listed, with 0
              for the ones that have no exam yet. */}
          {materials.length > 0 && (
            <Select
              value={activeSubject}
              items={selectItems}
              onValueChange={(value) => setSubject(value ?? "all")}
            >
              <SelectTrigger
                aria-label={t("Filter by subject")}
                className="h-9 max-w-[18rem] gap-2 border-zinc-200 bg-zinc-50 px-3 text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Filter className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="shrink-0 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {t("Subjects")}
                </span>
                <SelectValue className="min-w-0 truncate font-medium" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="end"
                sideOffset={8}
                className="z-50 max-h-[320px] min-w-[240px] overflow-y-auto border border-zinc-200 bg-white shadow-sm ring-0 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {subjectOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="gap-2 py-1.5 text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:text-zinc-100"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                        option.count === 0
                          ? "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                          : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                      )}
                    >
                      {option.count}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {loading ? (
        <DataLoading label="Loading exams…" />
      ) : exams.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No exams have been published for your class yet.
        </p>
      ) : filteredExams.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {activeSubject !== "all"
            ? `No exams published for ${activeSubjectLabel} yet.`
            : "No exams have been published for your class yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-8">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No upcoming exams.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Past
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {past.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
