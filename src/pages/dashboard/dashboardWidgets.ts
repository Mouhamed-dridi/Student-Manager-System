// Operator dashboard catalog: the cards/charts that can be toggled from the
// "Personalize your dashboard" dialog. Persistence lives in
// src/lib/dashboardWidgets.ts so all three portals share one implementation.
//
// Ids are unchanged from the first version of this feature, which keeps the
// choices already saved under `ssm-dashboard-widgets` valid.

import {
  defaultWidgetPrefs,
  type DashboardWidget,
  type DashboardWidgetPrefs,
} from "@/lib/dashboardWidgets";

export type OperatorWidgetId =
  | "activeStudents"
  | "teachers"
  | "attendanceRate"
  | "revenueThisMonth"
  | "revenuePaidChart"
  | "revenuePlanChart";

export type OperatorWidgetPrefs = DashboardWidgetPrefs<OperatorWidgetId>;

export const OPERATOR_WIDGETS: DashboardWidget<OperatorWidgetId>[] = [
  {
    id: "activeStudents",
    label: "Active Students Card",
    description: "Students available for login.",
  },
  {
    id: "teachers",
    label: "Teachers Card",
    description: "Active teaching staff.",
  },
  {
    id: "attendanceRate",
    label: "Attendance Rate Card",
    description: "Presence density over the last 30 days.",
  },
  {
    id: "revenueThisMonth",
    label: "Revenue This Month Card",
    description: "Collected this month, plus the pending amount.",
  },
  {
    id: "revenuePaidChart",
    label: "Revenue — Paid (6 months) Graph",
    description: "Monthly paid revenue line chart.",
  },
  {
    id: "revenuePlanChart",
    label: "Revenue by Plan Donut Chart",
    description: "Paid revenue split per subscription plan.",
  },
];

export const OPERATOR_DEFAULT_WIDGET_PREFS = defaultWidgetPrefs(OPERATOR_WIDGETS);
