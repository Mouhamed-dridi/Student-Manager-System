import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, updatePublication } from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  RECIPIENT_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
  RecipientType,
} from "@/pages/publications/publicationTypes";

interface EditPublicationDialogProps {
  publication: Publication;
  onSaved: () => void;
  onClose: () => void;
}

export default function EditPublicationDialog({
  publication,
  onSaved,
  onClose,
}: EditPublicationDialogProps) {
  const [title, setTitle] = useState(publication.title);
  const [message, setMessage] = useState(publication.message);
  const [recipients, setRecipients] = useState<RecipientType[]>(
    publication.recipients,
  );
  const [notificationType, setNotificationType] = useState<NotificationType>(
    publication.type,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleValue = <T,>(list: T[], value: T, checked: boolean): T[] =>
    checked ? [...list, value] : list.filter((v) => v !== value);

  const handleSave = async () => {
    if (!title.trim() || !message.trim() || recipients.length === 0) {
      setError("Please fill in the title, message and at least one recipient.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePublication(publication.id, {
        title: title.trim(),
        message: message.trim(),
        recipients,
        type: notificationType,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Announcement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              placeholder="Enter announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-message">Message</Label>
            <Textarea
              id="edit-message"
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
                      name="edit-notification-type"
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
              {(Object.keys(RECIPIENT_LABELS) as RecipientType[]).map((r) => (
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
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
