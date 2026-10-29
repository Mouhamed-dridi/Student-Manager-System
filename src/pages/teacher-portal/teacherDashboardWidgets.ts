// Teacher dashboard catalog for the "Personalize your dashboard" dialog.
// Each id maps to one rendered card; persistence is shared with the operator
// and student portals (src/lib/dashboardWidgets.ts).

import {
  defaultWidgetPrefs,
  type DashboardWidget,
  type DashboardWidgetPrefs,
} from "@/lib/dashboardWidgets";

export type TeacherWidgetId =
  | "classes"
  | "students"
  | "attendance"
  | "planning"
  | "quizzes"
  | "announcements";

export type TeacherWidgetPrefs = DashboardWidgetPrefs<TeacherWidgetId>;

export const TEACHER_WIDGETS: DashboardWidget<TeacherWidgetId>[] = [
  {
    id: "classes",
    label: "Assigned Classes",
    description: "The courses attached to your class.",
  },
  {
    id: "students",
    label: "Active Students",
    description: "Students matched to the courses you teach.",
  },
  {
    id: "attendance",
    label: "Attendance Tracking",
    description: "Your own attendance entries in the log.",
  },
  {
    id: "planning",
    label: "Upcoming Planning / Schedule",
    description: "Sessions you planned from today onwards.",
  },
  {
    id: "quizzes",
    label: "Recent Submissions / Quizzes",
    description: "Your latest quizzes and how many answers they got.",
  },
  {
    id: "announcements",
    label: "Latest Announcements",
    description: "Notices sent to teachers.",
  },
];

export const TEACHER_DEFAULT_WIDGET_PREFS = defaultWidgetPrefs(TEACHER_WIDGETS);
