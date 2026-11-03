import type { PlanningSessionType } from "@/pages/teacher-portal/planning";

export function PlanningSessionTypeBadge({
  sessionType,
}: {
  sessionType: PlanningSessionType;
}) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {sessionType}
    </span>
  );
}
