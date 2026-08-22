import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Publication } from "@/pages/publications/PublicationsPage";

type Channel = Publication["channels"][number];

const CHANNEL_LABELS: Record<Channel, string> = {
  sms: "SMS",
  email: "Email",
  notification: "Notification",
};

function loadStudentAnnouncements(): Publication[] {
  try {
    const publications: Publication[] = JSON.parse(
      localStorage.getItem("publications") ?? "[]",
    );
    return publications
      .filter((p) => p.recipients.includes("students"))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  } catch {
    return [];
  }
}

export default function AnnouncementsPage() {
  const [announcements] =
    useState<Publication[]>(loadStudentAnnouncements);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Announcements</h2>

      {announcements.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No announcements yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
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
