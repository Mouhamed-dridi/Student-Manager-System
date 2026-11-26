import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import BranchLevelBadge from "@/pages/branches/BranchLevelBadge";
import {
  errorMessage,
  subscribeToTable,
  teacherAssignedClasses,
  type TeacherAssignedClass,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import StudentProfilePage from "@/components/StudentProfilePage";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

/** `students.blocked` is the only status flag a student row has, so Status is
 *  derived from it exactly like the operator's User Management table. */
function statusBadge(blocked?: boolean) {
  if (blocked) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      Active
    </span>
  );
}

/**
 * One assigned class: level badge, class name and the material(s) this teacher
 * teaches there. Rendered as a switcher button, only when the teacher has two
 * or more classes (a single assignment is summarised in the page header).
 */
function ClassCard({
  entry,
  active,
  onSelect,
}: {
  entry: TeacherAssignedClass;
  active: boolean;
  onSelect: () => void;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <BranchLevelBadge level={entry.level} />
        <span className="truncate text-sm font-semibold">{entry.name}</span>
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        {entry.materials.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No material assigned
          </span>
        ) : (
          entry.materials.map((material) => (
            <span
              key={material}
              className="inline-flex max-w-full items-center truncate rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {material}
            </span>
          ))
        )}
      </span>

      <span className="text-xs tabular-nums text-muted-foreground">
        {entry.students.length} student
        {entry.students.length === 1 ? "" : "s"}
      </span>
    </>
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-zinc-400 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:border-zinc-600",
        active
          ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      )}
    >
      {body}
    </button>
  );
}

export default function MyClassPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  // Every branch this teacher is staffed in (branch_materials + planning).
  const [classes, setClasses] = useState<TeacherAssignedClass[] | null>(null);
  // The switcher's selection; null means "first assigned class".
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The roster row whose full-page profile is open (null = closed). Read-only
  // for a teacher: no `onEdit`, so the shared page hides the edit action.
  const [profile, setProfile] = useState<Student | null>(null);

  const refresh = useCallback(async (record: Teacher) => {
    try {
      const list = await teacherAssignedClasses(record.id, record.fullName);
      setClasses(list);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled) return;
        if (!record) {
          setTeacher(null);
          return;
        }
        setTeacher(record);
        try {
          const list = await teacherAssignedClasses(record.id, record.fullName);
          if (cancelled) return;
          setClasses(list);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setError(errorMessage(err));
          setClasses([]);
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live roster: students added, edited, or removed by the operator appear
  // here without a manual refresh. The assigned-class list is re-resolved too,
  // so a material assignment picked up by focus refresh updates the switcher.
  useEffect(() => {
    if (!teacher) return;
    const offStudents = subscribeToTable("students", () =>
      void refresh(teacher),
    );
    return () => {
      offStudents();
    };
  }, [teacher, refresh]);

  // Quiet fallback: refresh once if the tab regains focus after being in the
  // background for a while, in case realtime silently dropped or the operator
  // changed this teacher's branch assignments.
  useRefetchOnFocus(() => {
    if (teacher) void refresh(teacher);
  });

  // The profile is a sub-page of My Class: the shared history stack makes the
  // header back arrow return to the roster, like the page's own Back button.
  useNestedView(
    profile !== null,
    "student-profile",
    "Student profile",
    () => setProfile(null),
  );

  // Prefer the latest row from any class roster so realtime refreshes keep the
  // open profile current; fall back to the captured object if it vanished.
  const profileStudent = profile
    ? ((classes ?? []).flatMap((entry) => entry.students).find(
        (student) => student.id === profile.id,
      ) ?? profile)
    : null;

  if (profileStudent) {
    return (
      <StudentProfilePage
        student={profileStudent}
        onBack={() => setProfile(null)}
        backLabel="Back to class"
      />
    );
  }

  if (teacher === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your teacher record could not be found.
      </p>
    );
  }

  if (teacher === undefined || classes === null) {
    return <DataLoading label="Loading your class…" />;
  }

  const activeClass =
    classes.find((entry) => entry.id === activeClassId) ?? classes[0] ?? null;
  const activeStudents = activeClass?.students ?? [];

  return (
    <div>
      <div>
        <h2 className="text-2xl font-semibold">My Class</h2>
        {activeClass && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[activeClass.level, activeClass.name].filter(Boolean).join(" · ")}
            {activeClass.materials.length > 0
              ? ` — ${activeClass.materials.join(", ")}`
              : ""}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {classes.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No class assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask the center to assign your materials to a class. Students
              appear here once a branch has one of your materials.
            </p>
          </CardContent>
        </Card>
      ) : activeClass ? (
        <>
          {/* A single assignment needs no switcher: the header already shows
              its level, name and material. Only multiple classes get pills. */}
          {classes.length > 1 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {classes.map((entry) => (
                <ClassCard
                  key={entry.id}
                  entry={entry}
                  active={entry.id === activeClass.id}
                  onSelect={() => setActiveClassId(entry.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <p className="mb-2 text-sm text-muted-foreground">
              {activeStudents.length} student
              {activeStudents.length === 1 ? "" : "s"} enrolled
            </p>

            {activeStudents.length === 0 ? (
              <Card className="max-w-xl">
                <CardContent className="py-8 text-center">
                  <p className="text-sm font-medium">No students found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nobody is enrolled in this class yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Track</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeStudents.map((s) => (
                      <TableRow
                        key={s.id}
                        onClick={() => setProfile(s)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfile(s);
                            }}
                            className="cursor-pointer text-left hover:underline"
                          >
                            {s.fullName}
                          </button>
                        </TableCell>
                        <TableCell>{s.phone || "—"}</TableCell>
                        <TableCell>{s.email || "—"}</TableCell>
                        <TableCell>
                          {[s.program, s.training]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell>{statusBadge(s.blocked)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
