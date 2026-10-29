// Student dashboard catalog for the "Personalize your dashboard" dialog.
// Persistence is shared with the operator and teacher portals
// (src/lib/dashboardWidgets.ts).

import {
  defaultWidgetPrefs,
  type DashboardWidget,
  type DashboardWidgetPrefs,
} from "@/lib/dashboardWidgets";

export type StudentWidgetId =
  | "courses"
  | "payments"
  | "attendance"
  | "exams"
  | "announcements"
  | "materials";

export type StudentWidgetPrefs = DashboardWidgetPrefs<StudentWidgetId>;

export const STUDENT_WIDGETS: DashboardWidget<StudentWidgetId>[] = [
  {
    id: "courses",
    label: "Enrolled Courses Progress",
    description: "Your class courses and the material attached to them.",
  },
  {
    id: "payments",
    label: "Pending Payments",
    description: "Invoices still waiting to be settled.",
  },
  {
    id: "attendance",
    label: "Attendance Record",
    description: "Attendance entries logged against your name.",
  },
  {
    id: "exams",
    label: "Upcoming Exams / QCM",
    description: "Exams and published quizzes ahead for you.",
  },
  {
    id: "announcements",
    label: "Recent Announcements",
    description: "Notices sent to students.",
  },
  {
    id: "materials",
    label: "Course Materials Quick Access",
    description: "Downloads attached to your courses.",
  },
];

export const STUDENT_DEFAULT_WIDGET_PREFS = defaultWidgetPrefs(STUDENT_WIDGETS);
