import { useState } from "react";
import AnnouncementCallout from "@/components/AnnouncementCallout";
import type { AnnouncementCalloutTone } from "@/components/AnnouncementCallout";
import type { Publication } from "@/pages/publications/publicationTypes";

/**
 * Notion-style callout blocks for role-targeted announcements, shown at the
 * top of a dashboard. Dismissals reset on reload unless the caller controls
 * them (the student dashboard does, so "Personalize" can restore them).
 */
export default function NotificationCallouts({
  publications,
  tone = "color",
  dismissedIds,
  onDismiss,
}: {
  publications: Publication[];
  /** `zinc` renders the monochrome student-workspace banners. */
  tone?: AnnouncementCalloutTone;
  /** Controlled list of hidden announcement ids. */
  dismissedIds?: ReadonlySet<string>;
  /** Called instead of (or in addition to) the local dismissal. */
  onDismiss?: (id: string) => void;
}) {
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());
  const dismissed = dismissedIds ?? localDismissed;

  const dismiss = (id: string) => {
    setLocalDismissed((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  const visible = publications.filter((p) => !dismissed.has(p.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((p) => (
        <AnnouncementCallout
          key={p.id}
          publication={p}
          tone={tone}
          onDismiss={() => dismiss(p.id)}
        />
      ))}
    </div>
  );
}
