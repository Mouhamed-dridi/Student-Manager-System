import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  NotificationType,
  Publication,
} from "@/pages/publications/PublicationsPage";

const CALLOUT_STYLES: Record<
  NotificationType,
  { container: string; icon: string; Icon: LucideIcon }
> = {
  urgent: {
    container: "bg-red-50 border-red-200 text-red-900",
    icon: "text-red-600",
    Icon: AlertOctagon,
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-900",
    icon: "text-amber-600",
    Icon: AlertTriangle,
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-900",
    icon: "text-blue-600",
    Icon: Info,
  },
};

function Callout({
  publication,
  onDismiss,
}: {
  publication: Publication;
  onDismiss: () => void;
}) {
  const { container, icon, Icon } =
    CALLOUT_STYLES[publication.type] ?? CALLOUT_STYLES.info;
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 shadow-sm ${container}`}>
      <Icon className={`w-5 h-5 ${icon} flex-shrink-0`} />
      <div className="flex-1">
        <p className="text-sm font-semibold">{publication.title}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm">
          {publication.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0"
      >
        <X className="w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600" />
      </button>
    </div>
  );
}

/**
 * Notion-style callout blocks for role-targeted announcements, shown at the
 * top of a dashboard. Dismissals are client-side only and reset on reload.
 */
export default function NotificationCallouts({
  publications,
}: {
  publications: Publication[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = publications.filter((p) => !dismissed.has(p.id));
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {visible.map((p) => (
        <Callout
          key={p.id}
          publication={p}
          onDismiss={() =>
            setDismissed((prev) => new Set(prev).add(p.id))
          }
        />
      ))}
    </div>
  );
}
