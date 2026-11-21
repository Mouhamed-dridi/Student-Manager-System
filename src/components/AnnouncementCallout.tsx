import { AlertOctagon, AlertTriangle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  NOTIFICATION_TYPE_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
} from "@/pages/publications/publicationTypes";
import { useT } from "@/lib/i18n";

/** `color` keeps the type colours; `zinc` is the monochrome dashboard skin. */
export type AnnouncementCalloutTone = "color" | "zinc";

const CALLOUT_STYLES: Record<
  NotificationType,
  { container: string; icon: string; badge: string; Icon: LucideIcon }
> = {
  urgent: {
    container: "bg-red-50 border-red-200 text-red-900",
    icon: "text-red-600",
    badge: "border-red-300 bg-red-100 text-red-700",
    Icon: AlertOctagon,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-900",
    icon: "text-amber-600",
    badge: "border-amber-300 bg-amber-100 text-amber-700",
    Icon: AlertTriangle,
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-900",
    icon: "text-blue-600",
    badge: "border-blue-300 bg-blue-100 text-blue-700",
    Icon: Info,
  },
};

// Strictly monochromatic zinc used by the student workspace: no yellow, orange
// or blue accents for any notification type.
const ZINC_STYLES = {
  container:
    "bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-100",
  icon: "text-zinc-500 dark:text-zinc-400",
  badge:
    "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

interface AnnouncementCalloutProps {
  publication: Publication;
  /** Renders a small pill with the notification type label. */
  showType?: boolean;
  /** Renders the publication timestamp under the message. */
  showDate?: boolean;
  /** When provided, renders the dismiss (X) button. */
  onDismiss?: () => void;
  /** Visual skin; the student dashboard uses `zinc`. */
  tone?: AnnouncementCalloutTone;
}

/** A single Notion-style callout block for one announcement. */
export default function AnnouncementCallout({
  publication,
  showType = false,
  showDate = false,
  onDismiss,
  tone = "color",
}: AnnouncementCalloutProps) {
  const t = useT();
  const typeStyle =
    CALLOUT_STYLES[publication.type] ?? CALLOUT_STYLES.info;
  // Zinc keeps the type's icon but drops its colour, so every banner reads as
  // the same neutral surface in both light and dark mode.
  const container = tone === "zinc" ? ZINC_STYLES.container : typeStyle.container;
  const icon = tone === "zinc" ? ZINC_STYLES.icon : typeStyle.icon;
  const badge =
    tone === "zinc"
      ? publication.type === "warning" || publication.type === "urgent"
        ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium"
        : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium"
      : typeStyle.badge;
  const Icon = typeStyle.Icon;
  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 shadow-sm ${container}`}
    >
      <Icon className={`w-5 h-5 ${icon} flex-shrink-0`} />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{publication.title}</p>
          {showType && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}
            >
              {t(NOTIFICATION_TYPE_LABELS[publication.type] ?? "Info / News")}
            </span>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm">
          {publication.message}
        </p>
        {showDate && publication.createdAt && (
          <p className="mt-1.5 text-xs opacity-70">
            {new Date(publication.createdAt).toLocaleString()}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("Dismiss notification")}
          className="shrink-0"
        >
          <X className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300" />
        </button>
      )}
    </div>
  );
}
