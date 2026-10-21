export interface PlanningRecord {
  id: string;
  teacherId: string;
  date: string; // yyyy-mm-dd
  course?: string;
  /** Class / vocational section the session was taught to (planning.class_name). */
  className?: string;
  /** Session window as a display string, e.g. "08:30 - 10:00". */
  sessionTime?: string;
  content: string;
}
