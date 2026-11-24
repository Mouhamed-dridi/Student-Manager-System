import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import ErrorBoundary from "@/components/ErrorBoundary";
import CourseDetailPage from "@/components/CourseDetailPage";
import { DataError, DataLoading } from "@/components/DataState";
import {
  classNameFor,
  errorMessage,
  listBranches,
  listBranchMaterials,
  listScheduledCourseSubjects,
  subscribeToTable,
} from "@/lib/api";
import type { BranchMaterialRecord } from "@/lib/api";
import {
  courseKey,
  normalizeCourseName,
  subjectNamesMatch,
} from "@/lib/courseDisplay";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import { loadCurrentStudent } from "./currentStudent";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

/**
 * The dropdown's matière list. The branch material catalog (Materials &
 * assigned teachers) is authoritative whenever it exists; the planification
 * subjects are only a fallback for databases that have not run the branches
 * migration. Planning can carry course titles, which must never become
 * matière options.
 */
function classMaterialCatalog(
  materials: BranchMaterialRecord[],
  plannedSubjects: string[],
): string[] {
  const source =
    materials.length > 0
      ? materials.map((material) => material.name)
      : plannedSubjects;
  return [...new Set(source.map((name) => name.trim()).filter(Boolean))];
}

/**
 * The materials (matières) a course belongs to, or an empty list when it
 * cannot be tied to the student's class. An explicit `courses.subject` wins;
 * a label that does not match the catalog ("SAP consulting" vs "ERP
 * Consulting") then falls back to a title match, and finally to every material
 * whose assigned teacher owns the course — never just one, because a teacher
 * can hold several materials and dropping the row would hide valid courses.
 * Courses with no resolvable material are not shown at all, so a course title
 * can never masquerade as a matière.
 */
function courseMaterials(
  course: ScheduledCourseView,
  materials: BranchMaterialRecord[],
  plannedSubjects: string[],
): string[] {
  const classMaterials = classMaterialCatalog(materials, plannedSubjects);
  const found = new Set<string>();
  const add = (name: string) => {
    const trimmed = name.trim();
    if (trimmed) found.add(trimmed);
  };
  const explicit = course.subject?.trim();
  if (explicit) {
    // No class catalog could be read (optional branches schema): trust the
    // course's own tag rather than hiding the row.
    if (classMaterials.length === 0) return [explicit];
    for (const name of classMaterials) {
      if (subjectNamesMatch(name, explicit)) add(name);
    }
  }
  if (found.size === 0) {
    for (const name of classMaterials) {
      if (subjectNamesMatch(course.name, name)) add(name);
    }
  }
  if (found.size === 0 && course.teacherId) {
    for (const material of materials) {
      if (material.teacherId === course.teacherId) add(material.name);
    }
  }
  return [...found];
}

/**
 * The branch that mirrors the student's class and its material catalog. The
 * catalog is loaded BEFORE the courses so the class filter can already keep a
 * course whose teacher is assigned one of these materials.
 */
async function loadClassMaterials(
  record: Student,
): Promise<BranchMaterialRecord[]> {
  if (!record.trainingId && !record.training) return [];
  const branches = await listBranches();
  // A missing FK must not stop the lookup: the normalized training name is
  // the fallback for legacy records.
  const wantedTraining = normalizeCourseName(record.training);
  const branch = branches.find(
    (b) =>
      (record.trainingId && b.trainingId === record.trainingId) ||
      (wantedTraining &&
        Boolean(record.training) &&
        subjectNamesMatch(b.name, record.training) &&
        (!record.programId || !b.programId || b.programId === record.programId)),
  );
  return branch ? listBranchMaterials(branch.id) : [];
}

export default function CoursesPage() {
  const { t } = useI18n();
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  // The course opened as a detail view, or null while the grid is showing.
  const [selected, setSelected] = useState<ScheduledCourseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subject (matière) filter state. "all" is the default so the grid shows
  // every course on load instead of starting on a non-matching filter.
  const [materials, setMaterials] = useState<BranchMaterialRecord[]>([]);
  const [subject, setSubject] = useState<string>("all");
  // The subjects the class actually follows (own sessions + shared modules).
  // Together with the branch's material catalog this builds the dropdown; a
  // course title is never offered as a matière.
  const [plannedSubjects, setPlannedSubjects] = useState<string[]>([]);

  // Course details is a sub-page of Courses: it registers with the shared
  // history stack so the header back arrow closes it like the in-page Back.
  useNestedView(
    selected !== null,
    "course-detail",
    t("Course details"),
    () => setSelected(null),
  );

  const refresh = useCallback(
    async (record: Student, mats: BranchMaterialRecord[]) => {
      try {
        setError(null);
        // The planification is the curriculum source of truth: it resolves the
        // class's course subjects plus the transverse modules shared with other
        // BTS specializations. A failed schedule read must not blank the page,
        // so it degrades to an empty subject list.
        const resolvedSubjects = await listScheduledCourseSubjects(
          classNameFor(record.program, record.training),
          {
            program: record.program,
            programId: record.programId,
            trainingId: record.trainingId,
          },
        ).catch(() => ({ planned: [] as string[], options: [] as string[] }));
        setPlannedSubjects(resolvedSubjects.planned);
        const list = await loadScheduledCourses(
          record.program,
          record.training,
          {
            programId: record.programId,
            trainingId: record.trainingId,
            scheduledSubjects: resolvedSubjects.planned,
            classMaterials: mats.map((material) => material.name),
            classTeacherIds: mats
              .map((material) => material.teacherId)
              .filter((id): id is string => Boolean(id)),
          },
        );
        setCourses(list);
        // Keep an open course in sync with the teacher's live edits. courseKey
        // is used instead of a bare `c.id === open.id` because the seeded
        // schedule entries have no id: every one of them is undefined, so that
        // test matched the first seeded course and the open detail silently
        // jumped to a different course on the next realtime update or tab
        // refocus. Falls back to the open snapshot when the course is gone.
        setSelected((open) => {
          if (!open) return null;
          return list.find((c) => courseKey(c) === courseKey(open)) ?? open;
        });
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [],
  );

  // One sequential load: session record -> class material catalog -> courses.
  // The order matters, because the catalog is what tells the course query that
  // a teacher assigned to a material of this class belongs here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let record: Student | null = null;
      try {
        record = await loadCurrentStudent();
      } catch {
        record = null;
      }
      if (cancelled) return;
      setStudent(record);
      if (!record) return;
      // A missing branches schema only means no catalog; the fallback subject
      // list still drives the page.
      const mats = await loadClassMaterials(record).catch(
        () => [] as BranchMaterialRecord[],
      );
      if (cancelled) return;
      setMaterials(mats);
      await refresh(record, mats);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student) return;
    return subscribeToTable("courses", () =>
      void refresh(student, materials),
    );
  }, [student, materials, refresh]);

  useRefetchOnFocus(() => {
    if (student) void refresh(student, materials);
  });

  // Build a teacher name map from materials (material teacher) and courses (course teacherId)
  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of materials) {
      if (m.teacherId && m.teacherName) {
        map.set(m.teacherId, m.teacherName);
      }
    }
    return map;
  }, [materials]);

  // Courses that resolve to at least one material of this class. Everything
  // else is dropped: the student only sees courses taught under their own
  // matérias.
  const linkedCourses = useMemo(() => {
    if (!courses) return null;
    return courses.flatMap((course) => {
      const linked = courseMaterials(course, materials, plannedSubjects);
      return linked.length > 0 ? [{ course, materials: linked }] : [];
    });
  }, [courses, materials, plannedSubjects]);

  // The selectable matières are the class's material catalog; the planification
  // subjects are only a fallback when that catalog is unavailable — never
  // course titles. Built before courses load so the dropdown is never hidden on
  // an empty page.
  const subjectOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    const addSubject = (name: string | undefined) => {
      const value = normalizeCourseName(name);
      if (!value || seen.has(value)) return;
      seen.set(value, { value, label: (name ?? "").trim() });
    };
    for (const name of classMaterialCatalog(materials, plannedSubjects)) {
      addSubject(name);
    }
    const linked = linkedCourses ?? [];
    const options = [...seen.values()]
      .map((option) => ({
        ...option,
        count: linked.filter((entry) =>
          entry.materials.some((material) =>
            subjectNamesMatch(material, option.value),
          ),
        ).length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      { value: "all", label: t("All subjects"), count: linked.length },
      ...options,
    ];
  }, [materials, plannedSubjects, linkedCourses, t]);

  const selectItems = useMemo(
    () => subjectOptions.map(({ value, label }) => ({ value, label })),
    [subjectOptions],
  );

  // A matière that disappears (material deleted, session dropped, class
  // changed) must not leave the grid stuck on an empty filter. Derived during
  // render rather than written back to state from an effect.
  const activeSubject = subjectOptions.some(
    (option) => option.value === subject,
  )
    ? subject
    : "all";

  const filteredCourses = useMemo(() => {
    if (!linkedCourses) return null;
    if (activeSubject === "all") {
      return linkedCourses.map((entry) => entry.course);
    }
    return linkedCourses
      .filter((entry) =>
        entry.materials.some((material) =>
          subjectNamesMatch(material, activeSubject),
        ),
      )
      .map((entry) => entry.course);
  }, [linkedCourses, activeSubject]);

  return (
    <div>
      {/* The detail view owns its own breadcrumb ("Back to courses"), so the
          listing heading is hidden while a course is open. */}
      {!selected && (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{t("Courses")}</h2>
          {student && student !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Assigned to {training} ({program})", {
                training: student.training || "—",
                program: student.program || "—",
              })}
            </p>
          )}
        </div>

        {/* Subject filter dropdown — top-right of header, aligned with the
            title. "All subjects" is the default so nothing is hidden on page
            load; each option carries the number of course cards it holds. */}
        <div className="flex items-center gap-2 pt-1">
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
                align="end"
                className="min-w-[15rem] border border-zinc-200 bg-white shadow-sm ring-0 dark:border-zinc-800 dark:bg-zinc-950"
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
        </div>
      </div>
      )}

      {student === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "Your student record could not be found. It may have been removed by the administration.",
          )}
        </p>
      ) : student === undefined ? (
        <DataLoading label={t("Loading courses…")} />
      ) : (
        <>
          {error && (
            <div className="mt-4">
              <DataError message={error} />
            </div>
          )}

          {filteredCourses === null ? (
            !error && <DataLoading label={t("Loading courses…")} />
          ) : selected ? (
            <div className="mt-4">
              {/* Coarse backstop: if the detail view itself throws, keep a way
                  back to the grid instead of an unmounted (blank) tree. The
                  key remounts the boundary when another course is opened, so a
                  previous failure is not shown against the new course. */}
              <ErrorBoundary
                key={courseKey(selected)}
                fallback={(error) => (
                  <Card>
                    <CardContent className="space-y-3 py-6">
                      <p className="text-sm font-medium">
                        {t("This course could not be displayed.")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {error.message || t("An unexpected error occurred.")}
                      </p>
                      <Button size="sm" onClick={() => setSelected(null)}>
                        {t("Back to courses")}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              >
                <CourseDetailPage
                  course={selected}
                  studentId={student.id}
                  studentName={student.fullName}
                  onBack={() => setSelected(null)}
                  backLabel={t("Back to courses")}
                />
              </ErrorBoundary>
            </div>
          ) : filteredCourses.length === 0 ? (
            <Card className="mt-4 max-w-xl border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {activeSubject !== "all"
                    ? t("No courses available for this subject")
                    : plannedSubjects.length > 0 || materials.length > 0
                      ? t(
                          "No course materials have been uploaded for your scheduled subjects yet.",
                        )
                      : t("No courses scheduled yet")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeSubject !== "all"
                    ? t("Try selecting a different subject or view all subjects.")
                    : plannedSubjects.length > 0 || materials.length > 0
                      ? t(
                          "Your planification lists subjects, but no course has been published for them so far.",
                        )
                      : t(
                          "Nothing has been planned for your program and training so far. Please check back later.",
                        )}
                </p>
                {activeSubject !== "all" ? (
                  <Button
                    variant="outline"
                    className="mt-4 border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => setSubject("all")}
                  >
                    {t("Show all subjects")}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4">
              <CourseCardsGrid
                courses={filteredCourses}
                training={student.training}
                onOpenCourse={setSelected}
                teacherNameMap={teacherNameMap}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
