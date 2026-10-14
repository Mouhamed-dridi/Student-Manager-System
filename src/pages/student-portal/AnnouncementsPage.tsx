import { useEffect, useState } from "react";
import { DataError, DataLoading } from "@/components/DataState";
import AnnouncementCallout from "@/components/AnnouncementCallout";
import { errorMessage, listPublications, subscribeToTable } from "@/lib/api";
import { markAnnouncementsRead } from "@/lib/announcementReads";
import type { Publication } from "@/pages/publications/publicationTypes";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Publication[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      listPublications()
        .then((all) => {
          if (cancelled) return;
          setError(null);
          setAnnouncements(
            all
              .filter((p) => p.recipients.includes("students"))
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              ),
          );
        })
        .catch((err) => {
          if (!cancelled) setError(errorMessage(err));
        });
    };
    run();
    const unsubscribe = subscribeToTable("publications", run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (announcements) {
      markAnnouncementsRead(
        "students",
        announcements.map((p) => p.id),
      );
    }
  }, [announcements]);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Announcements</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Messages and news published to students.
      </p>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {announcements === null ? (
        !error && <DataLoading label="Loading announcements…" />
      ) : announcements.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No announcements yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {announcements.map((p) => (
            <AnnouncementCallout
              key={p.id}
              publication={p}
              showType
              showDate
            />
          ))}
        </div>
      )}
    </div>
  );
}
