import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Users } from "lucide-react";
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
import { subjectTone } from "@/lib/subjectColors";
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
 * One assigned class, styled exactly like the operator's Branches card: level
 * badge and class name on the left, track-coloured status dot on the right,
 * the materials this teacher teaches in that class as the subtitle, and the
 * roster size with the open/selected action as the footer.
 *
 * Clicking a card selects the class, which switches the roster below the grid;
 * the open card keeps a crisp zinc ring so the selection is obvious.
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
  // Same colour rule as the Branches grid: the track decides the dot.
  const tone = subjectTone(entry.level || entry.program || entry.name);
  const materialLine =
    entry.materials.length > 0
      ? entry.materials.join(" / ")
      : "No material assigned";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "ring-2 ring-zinc-900 dark:ring-zinc-100",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <BranchLevelBadge level={entry.level} />
          <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold">
            {entry.name}
          </h3>
        </div>
        <span
          className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)}
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{materialLine}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {entry.students.length} student
          {entry.students.length === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 font-medium">
          {active ? (
            <>
              Selected
              <Check className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Open class
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </span>
      </div>
    </button>
  );
}

export default function MyClassPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  // Every branch this teacher is staffed in (branch_materials + planning).
  const [classes, setClasses] = useState<TeacherAssignedClass[] | null>(null);
  // The selected class; null means "first assigned class".
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
  // so a material assignment picked up by focus refresh updates the grid.
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
          {/* Every class this teacher has a material in, laid out like the
              operator's Branches grid. Clicking a card switches the roster. */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((entry) => (
              <ClassCard
                key={entry.id}
                entry={entry}
                active={entry.id === activeClass.id}
                onSelect={() => setActiveClassId(entry.id)}
              />
            ))}
          </div>

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
