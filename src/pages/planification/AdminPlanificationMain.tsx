// Operator "Planification" — step 1: the training overview.
//
// The main page no longer draws a day-of-week grid; it lists every training
// grouped by qualification track (CAP, BTP, BTS), exactly one card per training
// — never one per teacher — with the teachers assigned to it summarised on the
// card and the branch's session count for the week in view.
// Every card — assigned or not — opens the same step 2: the branch timetable
// (BranchPlanningPage) for that training, with the standard 2-hour slot rows
// and the wide session dialog. There is deliberately no second, teacher-scoped
// layout, so a training like "Contrôle qualité" or "Réseaux et sécurité
// informatique" behaves exactly like the others.
//
// Sections in this app are state, not routes (see AGENTS.md), so "step 2" is a
// nested view on the shared history stack rather than
// /admin/planification/teacher/:teacherId — the header arrow and the detail's
// own Back button both return here.
//
// The three sub-tabs (Emploi du temps / Emploi des examens / Planning PFE) are
// defined in planning.ts by the `session_type` values they show. The active tab
// filters the per-card counts here and is handed to the branch timetable, which
// filters its grid the same way and asks for the specialised exam dialog when
// the exam tab is active — so the tab bar and every grid can never disagree.
//
// Reads go through src/lib/api (no inline Supabase calls) and are joined in
// the client: `planning.teacher_id` has no FK to `teachers`, so an embedded
// PostgREST select of teachers would be rejected.

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SegmentedTabsList,
  SegmentedTabsTrigger,
} from "@/components/ui/segmented-tabs";
import { Tabs } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  listPlanning,
  listPrograms,
  listTeacherCourses,
  listTeachers,
  listTrainings,
} from "@/lib/api";
import type { TeacherCourseRecord } from "@/lib/trainings";
import {
  PLANNING_TABS,
  planningSessionTypesForTab,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningRecord,
  PlanningTab,
} from "@/pages/teacher-portal/planning";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import {
  addDays,
  dateKeyOf,
  formatWeekRange,
  startOfWeek,
} from "@/pages/student-portal/scheduleDates";
import BranchPlanningPage from "@/pages/branches/BranchPlanningPage";
import {
  PROGRAM_TIERS,
  sessionInTraining,
  teacherIdsForTraining,
  tierCodeOf,
} from "./tracks";
import type { TierCode } from "./tracks";

interface PlanificationData {
  planning: PlanningRecord[];
  teachers: Teacher[];
  programs: { id: string; code: string; name: string }[];
  trainings: { id: string; name: string; program_id: string }[];
  courses: TeacherCourseRecord[];
}

/** One training: the unit a card and the branch timetable represent. */
interface TrainingCardData {
  trainingId: string;
  trainingName: string;
  /** Normalised track the card is grouped under ("" when unknown). */
  tier: TierCode | "";
  /** Every teacher attached to this training, deduplicated and sorted. */
  teacherNames: string[];
  /** Sessions of the whole branch — all teachers — in the week in view. */
  weekSessions: number;
}

/** "No teacher assigned" / one name / the first two plus a count. */
function teacherSummary(teacherNames: string[]): string {
  if (teacherNames.length === 0) return "No teacher assigned";
  if (teacherNames.length === 1) return teacherNames[0];
  const head = teacherNames.slice(0, 2).join(", ");
  const rest = teacherNames.length - 2;
  return rest > 0 ? `${head} +${rest} more` : head;
}

function TrainingCard({
  card,
  onOpen,
}: {
  card: TrainingCardData;
  onOpen: () => void;
}) {
  // Every card is actionable: an unassigned training still needs its timetable
  // built, and that is where the operator assigns a teacher.
  const assigned = card.teacherNames.length > 0;
  const summary = teacherSummary(card.teacherNames);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        assigned
          ? `${card.trainingName}\n${card.teacherNames.join(", ")}`
          : `${card.trainingName} — open the timetable to add sessions`
      }
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !assigned && "border-dashed",
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
        <UsersRound className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{summary}</span>
        {card.teacherNames.length > 1 && (
          <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold">
            {card.teacherNames.length} teachers
          </span>
        )}
      </span>
      {!assigned && (
        <span className="flex items-center gap-1 text-[11px] font-medium">
          Open timetable to add sessions
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
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
              key={card.trainingId}
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
  // Sub-navigation: the timetable, the exam schedule or the PFE defences. It
  // filters both the per-card counts here and the grid of the opened branch.
  const [tab, setTab] = useState<PlanningTab>("timetable");
  // Step 2 target: the branch timetable of the clicked training.
  const [branchTrainingId, setBranchTrainingId] = useState<string | null>(null);

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

  if (branchTrainingId) {
    const training =
      data.trainings.find((item) => item.id === branchTrainingId) ?? null;
    if (training) {
      return (
        <BranchPlanningPage
          key={training.id}
          branch={{
            id: training.id,
            name: training.name,
            programId: training.program_id ?? "",
            programCode: programById.get(training.program_id)?.code ?? "",
          }}
          planning={data.planning}
          teachers={data.teachers}
          courses={data.courses}
          initialWeekStart={cursor}
          backLabel="Back to Planification"
          onBack={() => setBranchTrainingId(null)}
          onReload={reload}
          sessionTypes={planningSessionTypesForTab(tab)}
          examMode={tab === "exams"}
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
  // Only the sessions of the active tab count towards a card or the toolbar.
  const tabSessionTypes = planningSessionTypesForTab(tab);
  const tabWeekEntries = weekEntries.filter((entry) =>
    tabSessionTypes.includes(entry.sessionType),
  );

  // Exactly one card per training. The teacher list is no longer a fan-out, but
  // a duplicated `trainings` row (same id, or the same name under the same
  // program) would still print the branch twice, so collapse those here.
  const uniqueTrainings = Array.from(
    new Map(
      data.trainings.map((training) => [
        `${(training.program_id ?? "").trim()}::${training.name.trim().toLocaleLowerCase()}`,
        training,
      ]),
    ).values(),
  );

  const cards: TrainingCardData[] = [];
  for (const training of uniqueTrainings) {
    const program = programById.get(training.program_id);

    // Assigned teachers come from the live schedule, the course catalog and —
    // for legacy rows that carry no scope columns — the teacher's own
    // program/training text. Shared with the Branches page (tracks.ts).
    // The card carries the whole list, so one training is one card.
    const teacherIds = [...new Set(teacherIdsForTraining(training, data))].sort(
      (a, b) =>
        (teacherById.get(a)?.fullName ?? "").localeCompare(
          teacherById.get(b)?.fullName ?? "",
        ),
    );
    const teacherNames = [
      ...new Set(
        teacherIds.map(
          (teacherId) =>
            teacherById.get(teacherId)?.fullName ?? "Unknown teacher",
        ),
      ),
    ];

    cards.push({
      trainingId: training.id,
      trainingName: training.name,
      tier: tierCodeOf(program?.code ?? ""),
      teacherNames,
      // The branch total: every session of the training in this week, whoever
      // teaches it, matching how the timetable counts them.
      weekSessions: tabWeekEntries.filter((entry) =>
        sessionInTraining(entry, training),
      ).length,
    });
  }

  cards.sort((a, b) => a.trainingName.localeCompare(b.trainingName));

  const otherCards = cards.filter((card) => card.tier === "");
  // One handler for every card: the branch timetable is the single editing
  // surface, whether or not a teacher is already assigned. Assigning the
  // teacher (or the room, subject, slot and note) happens inside its dialog.
  const openCard = (card: TrainingCardData) => {
    setBranchTrainingId(card.trainingId);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Planification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Trainings by track. Open a card for its weekly timetable — the standard
        slot grid, where sessions, teachers and rooms are edited.
      </p>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PlanningTab)}
        className="mt-6"
      >
        <SegmentedTabsList aria-label="Planification view">
          {PLANNING_TABS.map((option) => (
            <SegmentedTabsTrigger key={option.key} value={option.key}>
              {option.label}
            </SegmentedTabsTrigger>
          ))}
        </SegmentedTabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
          {uniqueTrainings.length}{" "}
          {uniqueTrainings.length === 1 ? "training" : "trainings"} ·{" "}
          {tabWeekEntries.length}{" "}
          {tabWeekEntries.length === 1 ? "session" : "sessions"} in this view
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
                key={card.trainingId}
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
