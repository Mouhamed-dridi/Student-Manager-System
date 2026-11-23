import { Video } from "lucide-react";
import { PlanningRoomBadge } from "@/components/PlanningRoomBadge";
import { cn } from "@/lib/utils";
import {
  ONLINE_SESSION_LOCATION,
  type PlanningSessionType,
} from "@/pages/teacher-portal/planning";

/**
 * The location chip for a planning session: an Online session meets on the
 * meeting platform, so it shows "MS Teams" (with a video icon) instead of the
 * physical room it may still have stored from before it moved online. Shared by
 * the teacher page, the student schedule, the branch timetable and the operator
 * planning editor so the four render sites cannot drift.
 */
export function PlanningLocationBadge({
  room,
  sessionType,
  monochrome = false,
}: {
  room?: string | null;
  sessionType?: PlanningSessionType | null;
  /** Strict zinc rendering, for the teacher page's monochrome views. */
  monochrome?: boolean;
}) {
  if (sessionType === "Online") {
    return (
      <span
        title={`Online session on ${ONLINE_SESSION_LOCATION}`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
          monochrome
            ? "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400"
            : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        )}
      >
        <Video className="h-3 w-3 shrink-0" />
        {ONLINE_SESSION_LOCATION}
      </span>
    );
  }

  return room ? <PlanningRoomBadge room={room} /> : null;
}
