export const PLANNING_SESSION_TYPES = [
  "In-class",
  "Online",
  "Exam",
  "Soutenance",
] as const;

export type PlanningSessionType = (typeof PLANNING_SESSION_TYPES)[number];

export function isPlanningSessionType(
  value: string | null | undefined,
): value is PlanningSessionType {
  return PLANNING_SESSION_TYPES.some((sessionType) => sessionType === value);
}

export interface PlanningRecord {
  id: string;
  teacherId: string;
  date: string; // yyyy-mm-dd
  course?: string;
  sessionType: PlanningSessionType;
  /** Class / vocational section the session was taught to (planning.class_name). */
  className?: string;
  /** Session window as a display string, e.g. "08:30 - 10:00". */
  sessionTime?: string;
  /** Stable class scope, used by the student portal to find this session. */
  programId?: string;
  trainingId?: string;
  content: string;
}
