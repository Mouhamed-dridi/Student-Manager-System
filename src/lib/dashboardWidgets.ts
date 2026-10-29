// Shared plumbing for the per-portal "Personalize your dashboard" feature.
//
// Each portal declares its own widget catalog (ids + labels) and stores the
// resulting visibility map in localStorage:
//   - operator ......... `ssm-dashboard-widgets`            (unchanged key)
//   - teacher .......... `ssm-dashboard-widgets:teacher:<teacherId>`
//   - student .......... `ssm-dashboard-widgets:student:<studentId>`
// Keying the people portals by record id keeps two students (or two teachers)
// sharing one browser from inheriting each other's layout.
//
// Reads are defensive: corrupt JSON, unknown ids and non-boolean values fall
// back to "visible" for that widget instead of hiding a card behind the user's
// back. Writes are best-effort (private mode/quota) — the in-memory choice
// still applies for the session.

export interface DashboardWidget<Id extends string> {
  id: Id;
  /** Checkbox label in the customize dialog. */
  label: string;
  /** One-line explanation under the label. */
  description: string;
}

export type DashboardWidgetPrefs<Id extends string> = Record<Id, boolean>;

/** Every widget starts visible. */
export function defaultWidgetPrefs<Id extends string>(
  widgets: readonly DashboardWidget<Id>[],
): DashboardWidgetPrefs<Id> {
  const prefs = {} as DashboardWidgetPrefs<Id>;
  for (const widget of widgets) prefs[widget.id] = true;
  return prefs;
}

export function dashboardWidgetsKey(
  portal: "operator" | "teacher" | "student",
  personId?: string,
): string {
  if (!personId) return "ssm-dashboard-widgets";
  return `ssm-dashboard-widgets:${portal}:${personId}`;
}

export function loadWidgetPrefs<Id extends string>(
  key: string,
  widgets: readonly DashboardWidget<Id>[],
): DashboardWidgetPrefs<Id> {
  const prefs = defaultWidgetPrefs(widgets);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return prefs;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return prefs;
    for (const widget of widgets) {
      const value = (parsed as Record<string, unknown>)[widget.id];
      if (typeof value === "boolean") prefs[widget.id] = value;
    }
    return prefs;
  } catch {
    return prefs;
  }
}

export function saveWidgetPrefs<Id extends string>(
  key: string,
  prefs: DashboardWidgetPrefs<Id>,
): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — the choice only lasts for this session.
  }
}

/**
 * Column count follows how many stat widgets are still visible, so hiding one
 * never leaves a hole in the KPI row. Static strings keep Tailwind's scanner
 * happy (it cannot see interpolated class names).
 */
export function widgetStatGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}
