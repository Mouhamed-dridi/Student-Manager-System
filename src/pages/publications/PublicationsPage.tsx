import { useEffect, useState } from "react";
import { Trash2, CheckCircle2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RecipientType = "teachers" | "students";
type Channel = "sms" | "email" | "notification";

export interface Publication {
  id: string;
  title: string;
  message: string;
  recipients: RecipientType[];
  channels: Channel[];
  createdAt: string;
}

const STORAGE_KEY = "publications";

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  teachers: "Teachers",
  students: "Students",
};

const CHANNEL_LABELS: Record<Channel, string> = {
  sms: "SMS",
  email: "Email",
  notification: "Notification",
};

function loadPublications(): Publication[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function PublicationsPage() {
  const [publications, setPublications] =
    useState<Publication[]>(loadPublications);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientType[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publications));
  }, [publications]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const toggleValue = <T,>(list: T[], value: T, checked: boolean): T[] =>
    checked ? [...list, value] : list.filter((v) => v !== value);

  const handleDelete = (id: string) => {
    setPublications((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !message.trim()) {
      setError("Please fill in the title and message.");
      return;
    }
    if (recipients.length === 0 || channels.length === 0) {
      setError("Select at least one recipient and one channel.");
      return;
    }

    const publication: Publication = {
      id: crypto.randomUUID(),
      title: title.trim(),
      message: message.trim(),
      recipients,
      channels,
      createdAt: new Date().toISOString(),
    };

    setPublications((prev) => [publication, ...prev]);
    setTitle("");
    setMessage("");
    setRecipients([]);
    setChannels([]);

    const recipientNames = publication.recipients
      .map((r) => RECIPIENT_LABELS[r])
      .join(", ");
    const channelNames = publication.channels
      .map((c) => CHANNEL_LABELS[c])
      .join(", ");
    setSuccessMessage(
      `Announcement published to ${recipientNames} via ${channelNames}.`
    );
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

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex gap-6">
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={channels.includes(c)}
                      onCheckedChange={(checked) =>
                        setChannels((prev) => toggleValue(prev, c, checked === true))
                      }
                    />
                    {CHANNEL_LABELS[c]}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit">Publish Announcement</Button>
          </form>
        </CardContent>
      </Card>

      <h3 className="mt-8 text-lg font-medium">Publication History</h3>

      {publications.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No publications created yet.
        </p>
      ) : (
        <div className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publications.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    {new Date(p.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {p.recipients.map((r) => RECIPIENT_LABELS[r]).join(", ")}
                  </TableCell>
                  <TableCell>
                    {p.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete publication?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{p.title}" from the
                            history. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
