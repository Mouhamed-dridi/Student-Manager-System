import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listPublications } from "@/lib/api";
import type { Publication } from "@/pages/publications/PublicationsPage";

type Channel = Publication["channels"][number];

const CHANNEL_LABELS: Record<Channel, string> = {
  sms: "SMS",
  email: "Email",
  notification: "Notification",
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Publication[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublications()
      .then((all) =>
        setAnnouncements(
          all
            .filter((p) => p.recipients.includes("students"))
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            ),
        ),
      )
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Announcements</h2>

      <div className="mt-4">
        {error && <DataError message={error} />}
      </div>

      {announcements === null ? (
        !error && <DataLoading label="Loading announcements…" />
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No announcements yet.
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>
                  {new Date(p.createdAt).toLocaleString()} — via{" "}
                  {p.channels
                    .map((c) => CHANNEL_LABELS[c] ?? c)
                    .join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{p.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
