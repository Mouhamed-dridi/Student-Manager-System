import type { PlanningSessionType } from "@/pages/teacher-portal/planning";
import { cn } from "@/lib/utils";

// Exam sessions are the ones an operator scans for in a dense grid, so each
// exam family carries its own accent (red for the graded exams, amber for the
// principal/synthesis sittings, indigo for the practicals). Timetable sessions
// keep the neutral badge (PFE/STAGE/Soutenance lean violet so they still stand
// apart from a plain class).
const SESSION_TYPE_TONES: Partial<Record<PlanningSessionType, string>> = {
  DS: "border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300",
  Exam: "border-red-500/40 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300",
  Principale:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300",
  SYNTHESE:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300",
  TP: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-300",
  TD: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-300",
  PFE: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300",
  STAGE:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300",
  Soutenance:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-300",
};

export function PlanningSessionTypeBadge({
  sessionType,
}: {
  sessionType: PlanningSessionType;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        SESSION_TYPE_TONES[sessionType] ?? "border-border text-muted-foreground",
      )}
    >
      {sessionType}
    </span>
  );
}
