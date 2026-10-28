// Shared building blocks for the full-page people profiles (student and
// teacher). Both pages mount the same shell, hero, quick actions and info
// cards, which is what keeps the two views pixel-identical: never re-declare
// these styles in a profile page.
//
// The quick actions are monochrome by design (the app may run in dark mode, so
// each primitive ships the matching slate tokens). Actions are plain buttons:
// the page decides whether they open a tab, WhatsApp, LinkedIn or mailto.

import type { ReactNode } from "react";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

interface ProfilePageShellProps {
  name: string;
  /** Program/training, specialty or department — rendered as pill tags. */
  badges: Array<string | undefined | null>;
  /** Secondary line under the name (usually the primary email). */
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  /** Operator-only edit button, rendered opposite the back button. */
  editAction?: ReactNode;
  /** Quick-action icon cards rendered beside the avatar. */
  actions?: ReactNode;
  /** Usually the tab bar + panels. */
  children: ReactNode;
}

/** Back row + full-width hero card shared by every profile page. */
export function ProfilePageShell({
  name,
  badges,
  subtitle,
  backLabel,
  onBack,
  editAction,
  actions,
  children,
}: ProfilePageShellProps) {
  const tags = badges.filter(
    (badge, index, list): badge is string =>
      Boolean(badge) && list.indexOf(badge) === index,
  );

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        {editAction && <div className="ml-auto">{editAction}</div>}
      </div>

      <section className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-primary/10 via-muted/40 to-background px-6 py-7 sm:flex-row sm:items-center md:px-8">
          <UserAvatar name={name} className="h-24 w-24 border-2 text-3xl" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-background/80 px-2.5 py-0.5 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
              {subtitle && (
                <span className="truncate text-sm text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>

        {children}
      </section>
    </div>
  );
}

/**
 * Monochrome icon action card with a hover/focus tooltip. A missing value
 * renders the same card dimmed, so the row keeps its shape.
 *
 * `icon` is a node, not a component type, so the caller can pass a Lucide
 * component or a FontAwesome `<FontAwesomeIcon>` without this module knowing
 * about either icon library. Sizing lives here: the wrapper is a 20px box and
 * FontAwesome's own CSS sizes its svg to `1em`, which keeps both libraries
 * optically identical in the action bar.
 */
export function ProfileQuickAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={disabled ? `${label} unavailable` : label}
      aria-disabled={disabled || undefined}
      className={cn(
        "group/action relative inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-900",
        disabled &&
          "cursor-not-allowed opacity-40 hover:bg-white dark:hover:bg-slate-950",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center text-xl leading-none [--fa-width:1em]"
      >
        {icon}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity delay-100 group-hover/action:opacity-100 group-focus-visible/action:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

/** One tile in the contact/academic grids. */
export function ProfileInfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

/** Active/blocked pill, shared by both people tables. */
export function ProfileStatusPill({ blocked }: { blocked?: boolean }) {
  return blocked ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
      <ShieldAlert className="h-3 w-3" />
      Blocked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      <ShieldCheck className="h-3 w-3" />
      Active
    </span>
  );
}
