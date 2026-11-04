// Operator "Branches" — the timetable entry point.
//
// A branch is a training of a track ("BTS · Réseaux et sécurité
// informatique"), which is exactly how the rest of the app already scopes a
// class, so no new table is needed. The page lists every branch as a card with
// its assigned teachers and how much planning it already has; opening one swaps
// in the weekly timetable for that branch (BranchPlanningPage).
//
// Sections are state, not routes (see AGENTS.md), so the timetable is a nested
// view on the shared history stack rather than a /branches/:id URL.

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listPlanning,
  listPrograms,
  listTeacherCourses,
  listTeachers,
  listTrainings,
} from "@/lib/api";
import { subjectTone } from "@/lib/subjectColors";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type { PlanningRecord } from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import {
  sessionInTraining,
  teacherIdsForTraining,
  tierCodeOf,
} from "@/pages/planification/tracks";
import BranchPlanningPage from "./BranchPlanningPage";

export interface Branch {
  id: string;
  name: string;
  programId: string;
  programCode: string;
}

interface BranchesData {
  planning: PlanningRecord[];
  teachers: Teacher[];
  courses: TeacherCourseRecord[];
  branches: Branch[];
}

function branchSessionsCount(
  branch: Branch,
  planning: PlanningRecord[],
): number {
  return planning.filter((entry) => sessionInTraining(entry, branch)).length;
}

function BranchCard({
  branch,
  teacherNames,
  sessionCount,
  onOpen,
}: {
  branch: Branch;
  teacherNames: string[];
  sessionCount: number;
  onOpen: () => void;
}) {
  const tier = tierCodeOf(branch.programCode);
  // A branch's colour follows its track, so the overview reads as groups even
  // before the admin opens a card.
  const tone = subjectTone(tier || branch.programCode || branch.name);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            {branch.programCode || "Branch"}
          </span>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold">
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
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
        </span>
        <span className="inline-flex items-center gap-1 font-medium">
          Open timetable
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export default function BranchesPage() {
  const [data, setData] = useState<BranchesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Branch | null>(null);

  const load = useCallback(async (): Promise<BranchesData> => {
    const [planning, teachers, courses, programs, trainings] =
      await Promise.all([
        listPlanning(),
        listTeachers(),
        listTeacherCourses(),
        listPrograms(),
        listTrainings(),
      ]);
    const programById = new Map(programs.map((program) => [program.id, program]));
    const branches: Branch[] = trainings
      .map((training) => {
        const program = programById.get(training.program_id);
        return {
          id: training.id,
          name: training.name,
          programId: training.program_id ?? "",
          programCode: program?.code ?? "",
        };
      })
      .sort(
        (a, b) =>
          a.programCode.localeCompare(b.programCode) ||
          a.name.localeCompare(b.name),
      );
    return { planning, teachers, courses, branches };
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

  if (selected) {
    return (
      <BranchPlanningPage
        key={selected.id}
        branch={selected}
        planning={data.planning}
        teachers={data.teachers}
        courses={data.courses}
        onBack={() => setSelected(null)}
        onReload={reload}
      />
    );
  }

  const teacherById = new Map(data.teachers.map((teacher) => [teacher.id, teacher]));

  return (
    <div>
      <h2 className="text-2xl font-semibold">Branches</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every branch in the center. Open one to build or edit its weekly
        timetable.
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
            Branches come from the trainings table — add a program and its
            trainings first, then their timetables appear here.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.branches.map((branch) => {
            const teacherNames = teacherIdsForTraining(branch, data)
              .map((id) => teacherById.get(id)?.fullName)
              .filter((name): name is string => Boolean(name));
            return (
              <BranchCard
                key={branch.id}
                branch={branch}
                teacherNames={teacherNames}
                sessionCount={branchSessionsCount(branch, data.planning)}
                onOpen={() => setSelected(branch)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
