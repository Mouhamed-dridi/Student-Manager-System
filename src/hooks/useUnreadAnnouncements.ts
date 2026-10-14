import { useCallback, useEffect, useState } from "react";
import { listPublications, subscribeToTable } from "@/lib/api";
import {
  getReadAnnouncementIds,
  onAnnouncementsRead,
} from "@/lib/announcementReads";
import type { RecipientType } from "@/pages/publications/publicationTypes";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";

/**
 * Number of announcements targeted at `role` that the user has not opened yet,
 * for the sidebar badge. Kept in sync with the live table and with read-state
 * changes (the announcements page marks the list read on mount).
 */
export function useUnreadAnnouncements(role: RecipientType): number {
  const [unread, setUnread] = useState(0);

  const run = useCallback(() => {
    listPublications()
      .then((publications) => {
        const read = getReadAnnouncementIds(role);
        setUnread(
          publications.filter(
            (p) => p.recipients.includes(role) && !read.has(p.id),
          ).length,
        );
      })
      .catch(() => {
        // Keep the previous value on a failed read.
      });
  }, [role]);

  useEffect(() => {
    run();
    const offRead = onAnnouncementsRead(run);
    const offLive = subscribeToTable("publications", run);
    return () => {
      offRead();
      offLive();
    };
  }, [run]);

  useRefetchOnFocus(run);

  return unread;
}
