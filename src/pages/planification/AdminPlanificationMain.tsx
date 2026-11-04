// Operator "Planification" — step 1: the training overview.
//
// The main page no longer draws a day-of-week grid; it lists every training
// grouped by qualification track (CAP, BTP, BTS), one card per training and
// assigned teacher, with that teacher's session count for the week in view.
// Clicking a card opens step 2 (AdminTeacherPlanningDetail) for that
// teacher + training.
//
// Sections in this app are state, not routes (see AGENTS.md), so "step 2" is a
// nested view on the shared history stack rather than
// /admin/planification/teacher/:teacherId — the header arrow and the detail's
// own Back button both return here.
//
// Reads go through src/lib/api (no inline Supabase calls) and are joined in
// the client: `planning.teacher_id` has no FK to `teachers`, so an embedded
// PostgREST select of teachers would be rejected.

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataError, DataLoading } from "@/components/DataState";
import { cn } from "@/lib/utils";
import {
  classNameFor,
  errorMessage,
  listPlanning,
  listPrograms,
  listTeacherCourses,
  listTeachers,
  listTrainings,
} from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";
import type {
  PlanningClassOption,
  PlanningRecord,
} from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import {
  addDays,
  dateKeyOf,
  formatWeekRange,
  startOfWeek,
} from "@/pages/student-portal/scheduleDates";
import AdminTeacherPlanningDetail from "./AdminTeacherPlanningDetail";
import { PROGRAM_TIERS, sessionInTraining, tierCodeOf } from "./tracks";
import type { TierCode } from "./tracks";

interface PlanificationData {
  planning: PlanningRecord[];
  teachers: Teacher[];
  programs: { id: string; code: string; name: string }[];
  trainings: { id: string; name: string; program_id: string }[];
  courses: TeacherCourseRecord[];
}

/** One training/teacher pairing: the unit a card and a detail view represent. */
interface TrainingCardData {
  key: string;
  trainingId: string;
  trainingName: string;
  /** Normalised track the card is grouped under ("" when unknown). */
  tier: TierCode | "";
  teacherId: string | null;
  teacherName: string;
  /** Sessions for this teacher + training in the week being viewed. */
  weekSessions: number;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function TrainingCard({
  card,
  onOpen,
}: {
  card: TrainingCardData;
  onOpen: () => void;
}) {
  const clickable = card.teacherId !== null;
  return (
    <button
      type="button"
      onClick={clickable ? onOpen : undefined}
      disabled={!clickable}
      title={
        clickable
          ? `${card.trainingName} — ${card.teacherName}`
          : `${card.trainingName} has no teacher assigned yet`
      }
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
        clickable
          ? "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          : "cursor-default border-dashed",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold line-clamp-2">
          {card.trainingName}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            card.weekSessions > 0
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground",
          )}
        >
          {card.weekSessions} this week
        </span>
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRound className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{card.teacherName}</span>
      </span>
    </button>
  );
}

/** One track column: a header card followed by its stacked trainings. */
function TrackColumn({
  code,
  cards,
  onOpen,
}: {
  code: TierCode;
  cards: TrainingCardData[];
  onOpen: (card: TrainingCardData) => void;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <div className="rounded-lg border border-foreground/20 bg-accent/60 px-3 py-2 text-center">
        <h3 className="text-sm font-semibold tracking-widest uppercase">
          {code}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {cards.length} {cards.length === 1 ? "training" : "trainings"}
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No trainings in this track yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {cards.map((card) => (
            <TrainingCard
              key={card.key}
              card={card}
              onOpen={() => onOpen(card)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminPlanificationMain() {
  const [data, setData] = useState<PlanificationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  // Step 2 target: which teacher's schedule, scoped to which training.
  const [detail, setDetail] = useState<{
    teacherId: string;
    trainingId: string;
  } | null>(null);

  const load = useCallback(async (): Promise<PlanificationData> => {
    const [planning, teachers, programs, trainings, courses] =
      await Promise.all([
        listPlanning(),
        listTeachers(),
        listPrograms(),
        listTrainings(),
        listTeacherCourses(),
      ]);
    return { planning, teachers, programs, trainings, courses };
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
        <h2 className="text-2xl font-semibold">Planification</h2>
        {error ? (
          <div className="mt-4">
            <DataError message={error} />
          </div>
        ) : (
          <DataLoading label="Loading the training overview…" />
        )}
      </div>
    );
  }

  const programById = new Map(data.programs.map((p) => [p.id, p]));
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));

  // Every class the catalog knows: the trainings table drives the form
  // dropdowns, so the operator can place a session on any of them.
  const classOptions: PlanningClassOption[] = data.trainings
    .map((training) => ({
      label: classNameFor(
        programById.get(training.program_id)?.code ?? "",
        training.name,
      ),
      programId: training.program_id || undefined,
      trainingId: training.id,
    }))
    .filter((option) => option.label)
    .sort((a, b) => a.label.localeCompare(b.label));

  const courseNames = [...new Set(data.courses.map((c) => c.name))].sort(
    (a, b) => a.localeCompare(b),
  );

  if (detail) {
    const teacher = teacherById.get(detail.teacherId) ?? null;
    const training =
      data.trainings.find((t) => t.id === detail.trainingId) ?? null;
    if (teacher && training) {
      return (
        <AdminTeacherPlanningDetail
          key={`${teacher.id}:${training.id}`}
          teacher={teacher}
          training={{
            id: training.id,
            name: training.name,
            programCode: programById.get(training.program_id)?.code ?? "",
          }}
          planning={data.planning}
          teachers={data.teachers}
          classOptions={classOptions}
          courseNames={courseNames}
          onBack={() => setDetail(null)}
          onChanged={reload}
        />
      );
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(cursor, index),
  );
  const weekKeys = weekDays.map(dateKeyOf);
  const weekKeySet = new Set(weekKeys);
  const weekEntries = data.planning.filter((entry) =>
    weekKeySet.has(entry.date),
  );

  const cards: TrainingCardData[] = [];
  for (const training of data.trainings) {
    const program = programById.get(training.program_id);
    const programCode = program?.code ?? "";
    const tier = tierCodeOf(programCode);

    // Assigned teachers come from the live schedule, the course catalog and —
    // for legacy rows that carry no scope columns — the teacher's own
    // program/training text.
    const teacherIds = new Set<string>();
    for (const entry of data.planning) {
      if (entry.teacherId && sessionInTraining(entry, training)) {
        teacherIds.add(entry.teacherId);
      }
    }
    for (const course of data.courses) {
      if (course.trainingId === training.id && course.teacherId) {
        teacherIds.add(course.teacherId);
      }
    }
    const trainingName = normalize(training.name);
    for (const teacher of data.teachers) {
      if (trainingName && normalize(teacher.training) === trainingName) {
        teacherIds.add(teacher.id);
      }
    }

    const weekSessionsFor = (teacherId: string) =>
      weekEntries.filter(
        (entry) =>
          entry.teacherId === teacherId && sessionInTraining(entry, training),
      ).length;

    const base = {
      trainingId: training.id,
      trainingName: training.name,
      tier,
    };

    if (teacherIds.size === 0) {
      cards.push({
        ...base,
        key: `${training.id}:unassigned`,
        teacherId: null,
        teacherName: "No teacher assigned",
        weekSessions: 0,
      });
      continue;
    }

    for (const teacherId of teacherIds) {
      cards.push({
        ...base,
        key: `${training.id}:${teacherId}`,
        teacherId,
        teacherName: teacherById.get(teacherId)?.fullName ?? "Unknown teacher",
        weekSessions: weekSessionsFor(teacherId),
      });
    }
  }

  cards.sort(
    (a, b) =>
      a.trainingName.localeCompare(b.trainingName) ||
      a.teacherName.localeCompare(b.teacherName),
  );

  const otherCards = cards.filter((card) => card.tier === "");
  const openCard = (card: TrainingCardData) => {
    if (!card.teacherId) return;
    setDetail({ teacherId: card.teacherId, trainingId: card.trainingId });
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Planification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Trainings by track. Open a training to see that teacher&apos;s weekly
        schedule.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setCursor((current) => addDays(current, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {formatWeekRange(cursor)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setCursor((current) => addDays(current, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfWeek(new Date()))}
          >
            This week
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {data.trainings.length}{" "}
          {data.trainings.length === 1 ? "training" : "trainings"} ·{" "}
          {weekEntries.length}{" "}
          {weekEntries.length === 1 ? "session" : "sessions"} this week
        </span>
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        {PROGRAM_TIERS.map((tier) => (
          <TrackColumn
            key={tier.code}
            code={tier.code}
            cards={cards.filter((card) => card.tier === tier.code)}
            onOpen={openCard}
          />
        ))}
      </div>

      {/* Trainings whose program code is not one of the three tracks stay
          visible instead of being silently dropped from the overview. */}
      {otherCards.length > 0 ? (
        <section className="mt-8">
          <h3 className="border-b pb-2 text-sm font-semibold tracking-widest uppercase">
            Other programs
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {otherCards.map((card) => (
              <TrainingCard
                key={card.key}
                card={card}
                onOpen={() => openCard(card)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
