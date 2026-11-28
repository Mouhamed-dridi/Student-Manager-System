import type { MouseEvent } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { normalizeMeetingUrl } from "@/pages/teacher-portal/planning";

/**
 * The "Join Teams" chip of an online planning session. Rendered on the teacher
 * grid/linear cards and on the student weekly schedule, so the label and the
 * safety attributes cannot drift between the two portals.
 *
 * The teacher cards are buttons that open the entry editor, so the link stops
 * the click from bubbling: joining the meeting must never also open the edit
 * dialog. `normalizeMeetingUrl()` drops a malformed value, so a bad hand-typed
 * link is never rendered as a clickable href.
 */
export function PlanningMeetingLink({
  url,
  monochrome = false,
  className,
}: {
  url?: string | null;
  /** Strict zinc rendering, for the teacher page's monochrome views. */
  monochrome?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const href = normalizeMeetingUrl(url);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
      }}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
        monochrome
          ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          : "border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300",
        className,
      )}
    >
      <Video className="h-3 w-3 shrink-0" />
      {t("Join Teams")}
    </a>
  );
}
