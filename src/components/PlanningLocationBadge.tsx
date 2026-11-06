import { Video } from "lucide-react";
import { PlanningRoomBadge } from "@/components/PlanningRoomBadge";
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
}: {
  room?: string | null;
  sessionType?: PlanningSessionType | null;
}) {
  if (sessionType === "Online") {
    return (
      <span
        title={`Online session on ${ONLINE_SESSION_LOCATION}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
      >
        <Video className="h-3 w-3 shrink-0" />
        {ONLINE_SESSION_LOCATION}
      </span>
    );
  }

  return room ? <PlanningRoomBadge room={room} /> : null;
}
