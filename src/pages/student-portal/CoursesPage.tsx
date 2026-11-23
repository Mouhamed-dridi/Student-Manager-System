import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import ErrorBoundary from "@/components/ErrorBoundary";
import CourseDetailPage from "@/components/CourseDetailPage";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listBranches,
  listBranchMaterials,
  subscribeToTable,
} from "@/lib/api";
import type { BranchMaterialRecord, BranchRecord } from "@/lib/api";
import { courseKey, normalizeCourseName } from "@/lib/courseDisplay";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import { loadCurrentStudent } from "./currentStudent";
import { useI18n } from "@/lib/i18n";
import { Filter } from "lucide-react";

export default function CoursesPage() {
  const { t } = useI18n();
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  // The course opened as a detail view, or null while the grid is showing.
  const [selected, setSelected] = useState<ScheduledCourseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Support (course) filter state. "all" is the default so the grid shows
  // every course on load instead of starting on a non-matching filter.
  const [materials, setMaterials] = useState<BranchMaterialRecord[]>([]);
  const [support, setSupport] = useState<string>("all");

  // Course details is a sub-page of Courses: it registers with the shared
  // history stack so the header back arrow closes it like the in-page Back.
  useNestedView(
    selected !== null,
    "course-detail",
    t("Course details"),
    () => setSelected(null),
  );

  const refresh = useCallback(async (record: Student) => {
    try {
      setError(null);
      const list = await loadScheduledCourses(
        record.program,
        record.training,
        {
          programId: record.programId,
          trainingId: record.trainingId,
        },
      );
      setCourses(list);
      // A support that no longer exists (course renamed or deleted) must not
      // leave the grid stuck on an empty filter.
      setSupport((current) =>
        current === "all" ||
        list.some((c) => normalizeCourseName(c.name) === current)
          ? current
          : "all",
      );
      // Keep an open course in sync with the teacher's live edits. courseKey is
      // used instead of a bare `c.id === open.id` because the seeded schedule
      // entries have no id: every one of them is undefined, so that test
      // matched the first seeded course and the open detail silently jumped to
      // a different course on the next realtime update or tab refocus. Falls
      // back to the open snapshot when the course is gone entirely.
      setSelected((open) => {
        if (!open) return null;
        return list.find((c) => courseKey(c) === courseKey(open)) ?? open;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  // Local copies keep the branch lookup's dependencies explicit (the record
  // object itself changes identity on every refetch).
  const studentTrainingId = student?.trainingId;
  const studentTrainingName = student?.training;
  const studentProgramId = student?.programId;

  // Load branch materials for the student's class
  useEffect(() => {
    // A missing FK must not stop the lookup: the normalized training name is
    // the fallback for legacy records.
    if (!studentTrainingId && !studentTrainingName) return;
    let cancelled = false;
    listBranches()
      .then((branches: BranchRecord[]) => {
        if (cancelled) return;
        // Find the branch that mirrors this student's class. The FK is
        // authoritative; the normalized name is the fallback for branches or
        // students whose training FK was never filled in.
        const wantedTraining = normalizeCourseName(studentTrainingName);
        const branch = branches.find(
          (b) =>
            (studentTrainingId && b.trainingId === studentTrainingId) ||
            (wantedTraining &&
              normalizeCourseName(b.name) === wantedTraining &&
              (!studentProgramId ||
                !b.programId ||
                b.programId === studentProgramId)),
        );
        if (branch) {
          return listBranchMaterials(branch.id);
        }
        return [];
      })
      .then((mats) => {
        if (!cancelled && mats) setMaterials(mats);
      })
      .catch(() => {
        // Branch schema may not exist — degrade silently
      });
    return () => {
      cancelled = true;
    };
  }, [studentTrainingId, studentTrainingName, studentProgramId]);

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent()
      .then(async (record) => {
        if (cancelled) return;
        setStudent(record);
        if (record) await refresh(record);
      })
      .catch(() => {
        if (!cancelled) setStudent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student) return;
    return subscribeToTable("courses", () => void refresh(student));
  }, [student, refresh]);

  useRefetchOnFocus(() => {
    if (student) void refresh(student);
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

  // The selectable supports are the courses actually on screen (seeded +
  // teacher-added), not the branch materials: a course without a linked
  // branch_material used to be missing from the filter entirely.
  const supports = useMemo(() => {
    if (!courses) return [];
    const seen = new Map<
      string,
      { value: string; label: string; teacher?: string }
    >();
    for (const course of courses) {
      const value = normalizeCourseName(course.name);
      if (!value || seen.has(value)) continue;
      seen.set(value, {
        value,
        label: course.name,
        teacher: course.teacherId
          ? teacherNameMap.get(course.teacherId)
          : undefined,
      });
    }
    return [...seen.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [courses, teacherNameMap]);

  const filteredCourses = useMemo(() => {
    if (!courses) return null;
    if (support === "all") return courses;
    return courses.filter(
      (c) => normalizeCourseName(c.name) === support,
    );
  }, [courses, support]);

  return (
    <div>
      {/* The detail view owns its own breadcrumb ("Back to courses"), so the
          listing heading is hidden while a course is open. */}
      {!selected && (
      <div className="flex items-start justify-between gap-4">
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

        {/* Support filter dropdown — top-right of header. Its options are the
            courses on screen and "all" is the default, so nothing is hidden
            on page load. */}
        {student && supports.length > 1 && !selected && (
          <div className="flex items-center gap-2 pt-1">
            <Filter className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <select
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              aria-label={t("Filter by support")}
              className="max-w-[16rem] rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:ring-1 focus:ring-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-600"
            >
              <option value="all">{t("All supports")}</option>
              {supports.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.teacher ? ` — ${option.teacher}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
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
                  {support !== "all"
                    ? t("No courses match this support")
                    : t("No courses scheduled yet")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {support !== "all"
                    ? t("Try selecting a different material or view all courses.")
                    : t(
                        "Nothing has been planned for your program and training so far. Please check back later.",
                      )}
                </p>
                {support !== "all" ? (
                  <Button
                    variant="outline"
                    className="mt-4 border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => setSupport("all")}
                  >
                    {t("Show all courses")}
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
