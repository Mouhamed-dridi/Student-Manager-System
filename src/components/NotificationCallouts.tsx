import { useState } from "react";
import AnnouncementCallout from "@/components/AnnouncementCallout";
import type { Publication } from "@/pages/publications/publicationTypes";

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
        <AnnouncementCallout
          key={p.id}
          publication={p}
          onDismiss={() => setDismissed((prev) => new Set(prev).add(p.id))}
        />
      ))}
    </div>
  );
}
