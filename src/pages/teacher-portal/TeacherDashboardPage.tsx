import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import NotificationCallouts from "@/components/NotificationCallouts";
import { errorMessage, listPublications, subscribeToTable } from "@/lib/api";
import type { Publication } from "@/pages/publications/publicationTypes";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { loadCurrentTeacher } from "./currentTeacher";

export default function TeacherDashboardPage() {
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [announcements, setAnnouncements] = useState<Publication[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const pubs = await listPublications().catch(() => []);
      setAnnouncements(
        pubs
          .filter((p) => p.recipients.includes("teachers"))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          ),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then((record) => {
        if (cancelled) return;
        setTeacher(record);
        if (record) void refresh();
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (teacher === null) return;
    return subscribeToTable("publications", () => void refresh());
  }, [teacher, refresh]);

  useRefetchOnFocus(() => {
    if (teacher) void refresh();
  });

  if (teacher === undefined) {
    return <DataLoading label="Loading your dashboard…" />;
  }

  const firstName = (teacher?.fullName ?? "").trim().split(/\s+/)[0] || "Teacher";

  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back, {firstName}!
      </p>

      <NotificationCallouts publications={announcements ?? []} />

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Latest Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements === null ? (
            <DataLoading label="Loading announcements…" />
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            <ul className="divide-y">
              {announcements.slice(0, 3).map((p) => (
                <li key={p.id} className="py-2">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString()
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
