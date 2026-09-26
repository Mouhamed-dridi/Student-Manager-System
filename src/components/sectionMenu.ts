import {
  BookOpen,
  CalendarDays,
  CalendarX,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type MenuKey =
  | "dashboard"
  | "students"
  | "teachers"
  | "pay"
  | "pay-history"
  | "pay-trash"
  | "absence"
  | "publications"
  | "events"
  | "event-history"
  | "users"
  | "trash"
  | "settings";

export interface MenuItem {
  key: MenuKey;
  label: string;
  icon: LucideIcon;
  children?: { key: MenuKey; label: string }[];
}

export const menuItems: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "students", label: "Students", icon: Users },
  { key: "teachers", label: "Teachers", icon: GraduationCap },
  {
    key: "pay",
    label: "Pay",
    icon: DollarSign,
    children: [
      { key: "pay", label: "Payments" },
      { key: "pay-history", label: "History" },
      { key: "pay-trash", label: "Trash" },
    ],
  },
  { key: "absence", label: "Absence", icon: CalendarX },
  { key: "publications", label: "Publications", icon: BookOpen },
  {
    key: "events",
    label: "Events",
    icon: CalendarDays,
    children: [
      { key: "events", label: "New Event" },
      { key: "event-history", label: "Event History" },
    ],
  },
  { key: "users", label: "User Management", icon: UserCog },
  { key: "trash", label: "Trash", icon: Trash2 },
  { key: "settings", label: "Settings", icon: Settings },
];

/**
 * True when `active` is one of a collapsible parent's children. A parentless
 * item is never "in a section", so it returns false. Pay and Events list their
 * own key as the first child, so the parent page itself still highlights.
 */
export function isSectionActive(item: MenuItem, active: MenuKey): boolean {
  return item.children?.some((child) => child.key === active) ?? false;
}

/**
 * Next open-state for a collapsible parent. Entering a section always opens it;
 * clicking the parent while already inside collapses it.
 *
 * `?? true` matters: a section that has never been toggled has no entry, and a
 * plain `!prev[key]` would read `undefined` as "open" and refuse to collapse.
 */
export function toggleSectionOpen(
  prev: Record<string, boolean>,
  key: MenuKey,
  sectionActive: boolean,
): Record<string, boolean> {
  return { ...prev, [key]: sectionActive ? !(prev[key] ?? true) : true };
}

/** Whether a section's children should be visible. */
export function isSectionExpanded(
  openSections: Record<string, boolean>,
  item: MenuItem,
  active: MenuKey,
): boolean {
  return (openSections[item.key] ?? true) && isSectionActive(item, active);
}
