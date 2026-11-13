// Operator "Branches" — the class file entry point.
//
// A branch is the class record of one training (`public.branches`): level
// (CAP/BTP/BTS), display name and the training id the rest of the app already
// scopes by, plus its own module list in `public.branch_materials` where each
// material carries one teacher. The grid card opens the full-page class file
// (BranchDetailPage) — materials, per-material teacher assignment and the
// roster — and the timetable editor (BranchPlanningPage) is one button away.
//
// Sections are state, not routes (see AGENTS.md), so both are nested views on
// the shared history stack rather than /branches/:id URLs.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, UserRound, Users } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import {
  assignBranchMaterialTeacher,
  errorMessage,
  listBranchMaterials,
  listBranches,
  listPlanning,
  listStudents,
  listTeacherCourses,
  listTeachers,
  type BranchMaterialRecord,
  type BranchRecord,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { subjectTone } from "@/lib/subjectColors";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import BranchDetailPage from "./BranchDetailPage";
import BranchLevelBadge from "./BranchLevelBadge";
import BranchPlanningPage from "./BranchPlanningPage";
import { matchingTeachersForMaterial } from "./materialSpecialty";

/** Kept as the name BranchPlanningPage imports; the shape lives in the API. */
export type Branch = BranchRecord;

interface BranchesData {
  branches: BranchRecord[];
  materials: BranchMaterialRecord[];
  planning: PlanningRecord[];
  teachers: Teacher[];
  courses: TeacherCourseRecord[];
  students: Student[];
}

function teacherNamesOf(
  branch: BranchRecord,
  materials: BranchMaterialRecord[],
  teacherById: Map<string, Teacher>,
): string[] {
  const names = new Set<string>();
  for (const material of materials) {
    if (material.branchId !== branch.id || !material.teacherId) continue;
    const name = teacherById.get(material.teacherId)?.fullName;
    if (name) names.add(name);
  }
  return [...names];
}

function BranchCard({
  branch,
  teacherNames,
  materialCount,
  studentCount,
  onOpen,
}: {
  branch: BranchRecord;
  teacherNames: string[];
  materialCount: number;
  studentCount: number;
  onOpen: () => void;
}) {
  // The colour follows the track, so the grid reads as three groups even
  // before the admin opens a card.
  const tone = subjectTone(branch.level || branch.programCode || branch.name);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <BranchLevelBadge level={branch.level} />
          <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold">
            {branch.name}
          </h3>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {teacherNames.length === 0
            ? "No teacher assigned"
            : teacherNames.length <= 2
              ? teacherNames.join(", ")
              : `${teacherNames.slice(0, 2).join(", ")} +${teacherNames.length - 2}`}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs">
        <span className="inline-flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {materialCount} {materialCount === 1 ? "material" : "materials"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {studentCount} {studentCount === 1 ? "student" : "students"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium">
          Open class
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export default function BranchesPage() {
  const [data, setData] = useState<BranchesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timetableOpen, setTimetableOpen] = useState(false);

  const load = useCallback(async (): Promise<BranchesData> => {
    const [branches, materials, planning, teachers, courses, students] =
      await Promise.all([
        listBranches(),
        listBranchMaterials(),
        listPlanning(),
        listTeachers(),
        listTeacherCourses(),
        listStudents(),
      ]);
    return { branches, materials, planning, teachers, courses, students };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [load]);

  // Strict specialty matching applies to stored rows too, not just the
  // dropdowns: once per visit, clear an assignment whose teacher belongs to a
  // different family and auto-assign a material that has exactly one
  // specialist. Unrecognised material names are left alone (nothing to match).
  const realignedRef = useRef(false);
  useEffect(() => {
    if (!data || realignedRef.current || data.teachers.length === 0) return;
    const fixes: { id: string; teacherId: string | null }[] = [];
    for (const material of data.materials) {
      const match = matchingTeachersForMaterial(material.name, data.teachers);
      if (match.unmatched) continue;
      const valid = material.teacherId
        ? match.teachers.some((teacher) => teacher.id === material.teacherId)
        : false;
      if (valid) continue;
      if (match.teachers.length === 1) {
        fixes.push({ id: material.id, teacherId: match.teachers[0].id });
      } else if (material.teacherId) {
        fixes.push({ id: material.id, teacherId: null });
      }
    }
    if (fixes.length === 0) return;
    realignedRef.current = true;
    void (async () => {
      try {
        await Promise.all(
          fixes.map((fix) =>
            assignBranchMaterialTeacher(fix.id, fix.teacherId),
          ),
        );
        await reload();
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [data, reload]);

  // Branches and their materials are not in the realtime publication, so a
  // quiet refetch on focus keeps the grid in step with other tabs.
  useRefetchOnFocus(reload);

  if (!data) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Branches</h2>
        {error ? (
          <div className="mt-4">
            <DataError message={error} />
          </div>
        ) : (
          <DataLoading label="Loading branches…" />
        )}
      </div>
    );
  }

  const selected =
    data.branches.find((branch) => branch.id === selectedId) ?? null;

  if (selected && timetableOpen) {
    return (
      <BranchPlanningPage
        key={selected.id}
        branch={selected}
        planning={data.planning}
        teachers={data.teachers}
        courses={data.courses}
        onBack={() => setTimetableOpen(false)}
        onReload={reload}
      />
    );
  }

  if (selected) {
    return (
      <BranchDetailPage
        key={selected.id}
        branch={selected}
        materials={data.materials}
        teachers={data.teachers}
        enrolledStudents={data.students}
        onBack={() => {
          setSelectedId(null);
          setTimetableOpen(false);
        }}
        onOpenTimetable={() => setTimetableOpen(true)}
        onReload={reload}
      />
    );
  }

  const teacherById = new Map(
    data.teachers.map((teacher) => [teacher.id, teacher]),
  );
  const materialCountByBranch = new Map<string, number>();
  for (const material of data.materials) {
    materialCountByBranch.set(
      material.branchId,
      (materialCountByBranch.get(material.branchId) ?? 0) + 1,
    );
  }
  const studentCountByTraining = new Map<string, number>();
  for (const student of data.students) {
    if (!student.trainingId) continue;
    studentCountByTraining.set(
      student.trainingId,
      (studentCountByTraining.get(student.trainingId) ?? 0) + 1,
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Branches</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every class in the center. Open one to see its materials, the teacher of
        each material, and its students.
      </p>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {data.branches.length}{" "}
          {data.branches.length === 1 ? "branch" : "branches"}
        </span>
      </div>

      {data.branches.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No branches yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Branches live in the branches table. If this database predates it,
            run supabase/branches-materials-migration.sql in the Supabase SQL
            Editor, then reload.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              teacherNames={teacherNamesOf(branch, data.materials, teacherById)}
              materialCount={materialCountByBranch.get(branch.id) ?? 0}
              studentCount={
                branch.trainingId
                  ? (studentCountByTraining.get(branch.trainingId) ?? 0)
                  : 0
              }
              onOpen={() => {
                setSelectedId(branch.id);
                setTimetableOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
