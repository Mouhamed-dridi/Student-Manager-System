import { AlertOctagon, AlertTriangle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  NOTIFICATION_TYPE_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
} from "@/pages/publications/publicationTypes";

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

interface AnnouncementCalloutProps {
  publication: Publication;
  /** Renders a small pill with the notification type label. */
  showType?: boolean;
  /** Renders the publication timestamp under the message. */
  showDate?: boolean;
  /** When provided, renders the dismiss (X) button. */
  onDismiss?: () => void;
}

/** A single Notion-style callout block for one announcement. */
export default function AnnouncementCallout({
  publication,
  showType = false,
  showDate = false,
  onDismiss,
}: AnnouncementCalloutProps) {
  const { container, icon, badge, Icon } =
    CALLOUT_STYLES[publication.type] ?? CALLOUT_STYLES.info;
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
              {NOTIFICATION_TYPE_LABELS[publication.type] ?? "Info / News"}
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
          aria-label="Dismiss notification"
          className="shrink-0"
        >
          <X className="w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
}
