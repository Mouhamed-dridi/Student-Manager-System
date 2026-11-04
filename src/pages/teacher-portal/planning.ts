export const PLANNING_SESSION_TYPES = [
  "In-class",
  "Online",
  "Exam",
  "Soutenance",
] as const;

export type PlanningSessionType = (typeof PLANNING_SESSION_TYPES)[number];

/**
 * Rooms a session can be scheduled in. Rooms are not a table in this app, so
 * the entry form offers this fixed list and stores the pick in
 * `planning.room_name`.
 */
export const PLANNING_CLASSROOMS = [
  "B11",
  "C4",
  "A15",
  "F13",
  "B12",
  "A05",
  "A03",
  "D13",
] as const;

/** Pre-selected classroom for a new entry. */
export const DEFAULT_PLANNING_CLASSROOM = "B11";

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
  /** Room / classroom the session meets in, e.g. "ClassB1" or "AC11". */
  roomName?: string;
  /** Stable class scope, used by the student portal to find this session. */
  programId?: string;
  trainingId?: string;
  content: string;
}

/** One selectable class: the label shown in the form plus the FKs the entry stores. */
export interface PlanningClassOption {
  label: string;
  programId?: string;
  trainingId?: string;
}

/** Everything the entry form produces, ready for insertPlanning/updatePlanning. */
export interface PlanningEntryValues {
  course?: string;
  sessionType: PlanningSessionType;
  className?: string;
  programId?: string;
  trainingId?: string;
  sessionTime?: string;
  roomName?: string;
  content: string;
  /**
   * Operator only: the teacher the session belongs to after saving. The teacher
   * portal never sets it, so its entries always stay on the signed-in teacher.
   */
  teacherId?: string;
}
