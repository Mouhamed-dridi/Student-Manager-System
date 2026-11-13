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
import { courseKey } from "@/lib/courseDisplay";
import { loadScheduledCourses } from "@/lib/trainings";
import type { ScheduledCourseView } from "@/lib/trainings";
import type { Student } from "@/pages/students/StudentForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import { loadCurrentStudent } from "./currentStudent";
import { Filter } from "lucide-react";

export default function CoursesPage() {
  // undefined = session record still loading; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  // The course opened as a detail view, or null while the grid is showing.
  const [selected, setSelected] = useState<ScheduledCourseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Material filter state
  const [materials, setMaterials] = useState<BranchMaterialRecord[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");

  // Course details is a sub-page of Courses: it registers with the shared
  // history stack so the header back arrow closes it like the in-page Back.
  useNestedView(selected !== null, "course-detail", "Course details", () =>
    setSelected(null),
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

  // Load branch materials for the student's class
  useEffect(() => {
    if (!student?.trainingId) return;
    let cancelled = false;
    listBranches()
      .then((branches: BranchRecord[]) => {
        if (cancelled) return;
        // Find the branch that matches this student's training
        const branch = branches.find(
          (b) => b.trainingId === student.trainingId,
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
  }, [student?.trainingId]);

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

  // Filter courses by material name
  const filteredCourses = useMemo(() => {
    if (!courses) return null;
    if (!selectedMaterial) return courses;
    // Match course name against the selected material name (case-insensitive)
    const matName = selectedMaterial.toLowerCase();
    return courses.filter(
      (c) => c.name.toLowerCase().includes(matName) || matName.includes(c.name.toLowerCase()),
    );
  }, [courses, selectedMaterial]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Courses</h2>
          {student && student !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              Assigned to {student.training || "—"} ({student.program})
            </p>
          )}
        </div>

        {/* Material filter dropdown — top-right of header */}
        {student && materials.length > 0 && !selected && (
          <div className="flex items-center gap-2 pt-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Materials ({courses?.length ?? 0})</option>
              {materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                  {m.teacherName ? ` — ${m.teacherName}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {student === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Your student record could not be found. It may have been removed by
          the administration.
        </p>
      ) : student === undefined ? (
        <DataLoading label="Loading courses…" />
      ) : (
        <>
          {error && (
            <div className="mt-4">
              <DataError message={error} />
            </div>
          )}

          {filteredCourses === null ? (
            !error && <DataLoading label="Loading courses…" />
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
                        This course could not be displayed.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {error.message || "An unexpected error occurred."}
                      </p>
                      <Button size="sm" onClick={() => setSelected(null)}>
                        Back to courses
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
                  backLabel="Back to courses"
                />
              </ErrorBoundary>
            </div>
          ) : filteredCourses.length === 0 ? (
            <Card className="mt-4 max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">
                  {selectedMaterial
                    ? "No courses match this material"
                    : "No courses scheduled yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedMaterial
                    ? "Try selecting a different material or view all courses."
                    : "Nothing has been planned for your program and training so far. Please check back later."}
                </p>
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
