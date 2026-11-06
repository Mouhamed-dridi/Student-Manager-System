/**
 * Clash detection for the operator branch timetable.
 *
 * A session clashes with another one on the same day when their time windows
 * overlap and they share a teacher, a room, or a class. Sessions written
 * without a readable window are never flagged: there is nothing to compare,
 * and a false warning in a timetable is worse than no warning.
 *
 * The admin is warned, not blocked — real timetables sometimes double-book on
 * purpose (a shared room, a co-taught group) — so this module only reports.
 */

import type {
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";
import { planningTimeRange } from "@/pages/teacher-portal/planning";

export type PlanningConflictKind = "teacher" | "room" | "class";

export interface PlanningConflict {
  kind: PlanningConflictKind;
  /** The other session the candidate overlaps with. */
  other: PlanningRecord;
}

/** The fields a clash is judged on, so the entry form draft can be checked. */
export interface PlanningConflictCandidate {
  date: string;
  teacherId?: string;
  roomName?: string;
  sessionType?: PlanningSessionType;
  className?: string;
  sessionTime?: string;
}

function overlaps(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = planningTimeRange(a);
  const right = planningTimeRange(b);
  if (!left || !right) return false;
  return left.start < right.end && right.start < left.end;
}

// Online sessions all share the meeting platform as their location, so two of
// them overlapping is not a room double-booking.
function roomKey(entry: {
  roomName?: string;
  sessionType?: PlanningSessionType;
}): string {
  if (entry.sessionType === "Online") return "";
  return entry.roomName?.trim().toLocaleLowerCase() ?? "";
}

function classKey(entry: { className?: string }): string {
  return entry.className?.trim().toLocaleLowerCase() ?? "";
}

/**
 * Conflicts between `candidate` and the rest of `entries`. `ignoreId` leaves
 * the session being edited out of the comparison with itself.
 */
export function findPlanningConflicts(
  entries: PlanningRecord[],
  candidate: PlanningConflictCandidate,
  ignoreId?: string,
): PlanningConflict[] {
  const date = candidate.date?.slice(0, 10);
  if (!date) return [];

  const conflicts: PlanningConflict[] = [];
  for (const entry of entries) {
    if (entry.id === ignoreId) continue;
    if (entry.date?.slice(0, 10) !== date) continue;
    if (!overlaps(candidate.sessionTime, entry.sessionTime)) continue;

    if (
      candidate.teacherId &&
      entry.teacherId &&
      candidate.teacherId === entry.teacherId
    ) {
      conflicts.push({ kind: "teacher", other: entry });
    }

    const candidateRoom = roomKey({
      roomName: candidate.roomName,
      sessionType: candidate.sessionType,
    });
    if (candidateRoom && candidateRoom === roomKey(entry)) {
      conflicts.push({ kind: "room", other: entry });
    }

    const candidateClass = classKey({ className: candidate.className });
    if (candidateClass && candidateClass === classKey(entry)) {
      conflicts.push({ kind: "class", other: entry });
    }
  }
  return conflicts;
}

/**
 * Every clash among `entries`, keyed by session id so a card can show a badge
 * without re-scanning the list per cell. Entirely client-side: the planning
 * table has no uniqueness constraint that could express this.
 */
export function planningConflictMap(
  entries: PlanningRecord[],
): Map<string, PlanningConflict[]> {
  const map = new Map<string, PlanningConflict[]>();

  // Bucket by day first: the whole table is compared, so keeping the pairwise
  // pass inside one day avoids scanning every other date's sessions.
  const byDate = new Map<string, PlanningRecord[]>();
  for (const entry of entries) {
    const date = entry.date?.slice(0, 10);
    if (!date) continue;
    const bucket = byDate.get(date) ?? [];
    bucket.push(entry);
    byDate.set(date, bucket);
  }

  const add = (
    from: PlanningRecord,
    to: PlanningRecord,
    kind: PlanningConflictKind,
  ) => {
    const list = map.get(from.id) ?? [];
    list.push({ kind, other: to });
    map.set(from.id, list);
  };

  for (const bucket of byDate.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        if (a.id === b.id) continue;
        if (!overlaps(a.sessionTime, b.sessionTime)) continue;

        if (a.teacherId && a.teacherId === b.teacherId) {
          add(a, b, "teacher");
          add(b, a, "teacher");
        }
        const roomA = roomKey(a);
        if (roomA && roomA === roomKey(b)) {
          add(a, b, "room");
          add(b, a, "room");
        }
        const classA = classKey(a);
        if (classA && classA === classKey(b)) {
          add(a, b, "class");
          add(b, a, "class");
        }
      }
    }
  }
  return map;
}
