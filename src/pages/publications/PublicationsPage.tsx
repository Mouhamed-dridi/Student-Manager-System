import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, insertPublication } from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  RECIPIENT_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
  RecipientType,
} from "@/pages/publications/publicationTypes";

export default function PublicationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientType[]>([]);
  const [notificationType, setNotificationType] =
    useState<NotificationType>("info");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const toggleValue = <T,>(list: T[], value: T, checked: boolean): T[] =>
    checked ? [...list, value] : list.filter((v) => v !== value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !message.trim()) {
      setError("Please fill in the title and message.");
      return;
    }
    if (recipients.length === 0) {
      setError("Select at least one recipient.");
      return;
    }

    const publication: Publication = {
      id: crypto.randomUUID(),
      title: title.trim(),
      message: message.trim(),
      recipients,
      createdAt: new Date().toISOString(),
      type: notificationType,
    };

    try {
      await insertPublication(publication);
      setTitle("");
      setMessage("");
      setRecipients([]);
      setNotificationType("info");

      const recipientNames = publication.recipients
        .map((r) => RECIPIENT_LABELS[r])
        .join(", ");
      setSuccessMessage(`Announcement published to ${recipientNames}.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Publications</h2>

      {successMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <Card className="mt-4 max-w-2xl">
        <CardHeader>
          <CardTitle>New Announcement</CardTitle>
          <CardDescription>
            Create a publication to send to teachers and/or students. Messages
            are recorded but not actually delivered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter announcement title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notification Type</Label>
              <div className="flex flex-wrap gap-6">
                {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map(
                  (t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="notification-type"
                        value={t}
                        checked={notificationType === t}
                        onChange={() => setNotificationType(t)}
                        className="h-4 w-4 accent-primary"
                      />
                      {NOTIFICATION_TYPE_LABELS[t]}
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="flex gap-6">
                {(Object.keys(RECIPIENT_LABELS) as RecipientType[]).map(
                  (r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={recipients.includes(r)}
                        onCheckedChange={(checked) =>
                          setRecipients((prev) =>
                            toggleValue(prev, r, checked === true)
                          )
                        }
                      />
                      {RECIPIENT_LABELS[r]}
                    </label>
                  )
                )}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit">Publish Announcement</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
