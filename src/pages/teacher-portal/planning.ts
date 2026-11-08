/** Regular timetable sessions — the "Emploi du temps" tab. */
export const PLANNING_TIMETABLE_SESSION_TYPES = ["In-class", "Online"] as const;

/** Exam sessions — the "Emploi des examens" tab. */
export const PLANNING_EXAM_SESSION_TYPES = [
  "DS",
  "Exam",
  "TP",
  "TD",
  "Principale",
  "SYNTHESE",
] as const;

/**
 * Final-year projects — the "Planning PFE" tab. `STAGE` is an internship
 * preparation/feedback sitting, so it belongs with the defences rather than
 * with the exam kinds.
 */
export const PLANNING_PFE_SESSION_TYPES = [
  "PFE",
  "STAGE",
  "Soutenance",
] as const;

export const PLANNING_SESSION_TYPES = [
  ...PLANNING_TIMETABLE_SESSION_TYPES,
  ...PLANNING_EXAM_SESSION_TYPES,
  ...PLANNING_PFE_SESSION_TYPES,
] as const;

export type PlanningSessionType = (typeof PLANNING_SESSION_TYPES)[number];

export type PlanningTab = "timetable" | "exams" | "pfe";

/**
 * The three sub-navigation tabs of the operator Planification section. Each tab
 * is defined by the `planning.session_type` values it shows, so the tab bar,
 * the session counts and the branch grid can never disagree.
 */
export const PLANNING_TABS: readonly {
  key: PlanningTab;
  label: string;
  sessionTypes: readonly PlanningSessionType[];
}[] = [
  {
    key: "timetable",
    label: "Emploi du temps",
    sessionTypes: PLANNING_TIMETABLE_SESSION_TYPES,
  },
  {
    key: "exams",
    label: "Emploi des examens",
    sessionTypes: PLANNING_EXAM_SESSION_TYPES,
  },
  {
    key: "pfe",
    label: "Planning PFE",
    sessionTypes: PLANNING_PFE_SESSION_TYPES,
  },
];

/** Session types belonging to a tab; every type when the tab is unknown. */
export function planningSessionTypesForTab(
  tab: PlanningTab,
): readonly PlanningSessionType[] {
  return (
    PLANNING_TABS.find((option) => option.key === tab)?.sessionTypes ??
    PLANNING_SESSION_TYPES
  );
}

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

/**
 * Location stamped on an Online session (planning.room_name). Online sessions
 * never meet in a physical classroom, so the entry form stores the meeting
 * platform here and the planning views render it as a Teams badge.
 */
export const ONLINE_SESSION_LOCATION = "MS Teams";

/**
 * The timetable rows the operator branch grid is built from: five standardised
 * 2-hour blocks. A session is placed in a slot by matching its stored window
 * ("08:00 - 10:00"); sessions that keep another window become rows of their
 * own, and untimed ones land in a final "No time set" row, so nothing is ever
 * hidden from the grid.
 */
export const PLANNING_TIME_SLOTS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
] as const;

/** Row label for sessions stored without a time window. */
export const NO_TIME_SLOT = "No time set";

function padClock(value: string): string {
  return value.padStart(2, "0");
}

/**
 * "08:00 - 10:00" → minutes from midnight for both ends. Returns null when the
 * window is missing, unparsable, or does not move forward, which is how a
 * conflict check decides whether it can compare two sessions at all.
 */
export function planningTimeRange(
  value: string | null | undefined,
): { start: number; end: number } | null {
  const match = value?.match(
    /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/,
  );
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return end > start ? { start, end } : null;
}

/**
 * Canonical row key for a stored window, so "8:00-10:00" and the slot constant
 * "08:00 - 10:00" share one grid row.
 */
export function planningSlotKey(value: string | null | undefined): string {
  const match = value?.match(
    /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/,
  );
  if (!match) {
    const raw = value?.trim();
    return raw ? raw : NO_TIME_SLOT;
  }
  return `${padClock(match[1])}:${match[2]} - ${padClock(match[3])}:${match[4]}`;
}

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
  /** Session window as a display string, e.g. "10:00 - 12:00". */
  sessionTime?: string;
  /** Room / classroom the session meets in, e.g. "ClassB1" or "AC11". */
  roomName?: string;
  /** Stable class scope, used by the student portal to find this session. */
  programId?: string;
  trainingId?: string;
  content: string;
  /** Optional internal note for the operator; never shown to students. */
  notes?: string;
  /**
   * Jury committee of a PFE/STAGE/Soutenance session (`planning.jury_teacher_ids`).
   * `teacherId` stays the session's lead teacher; this list adds the panel
   * (supervisor, president, examiner). Absent on every other session kind.
   */
  juryTeacherIds?: string[];
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
  /** PFE only: the jury panel, written when the caller provides it. */
  juryTeacherIds?: string[];
  sessionType: PlanningSessionType;
  className?: string;
  programId?: string;
  trainingId?: string;
  sessionTime?: string;
  roomName?: string;
  content: string;
  /** Optional operator note (`planning.notes`); omitted by other callers. */
  notes?: string;
  /**
   * Operator only: the teacher the session belongs to after saving. The teacher
   * portal never sets it, so its entries always stay on the signed-in teacher.
   */
  teacherId?: string;
}
