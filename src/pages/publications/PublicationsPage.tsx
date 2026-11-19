// Operator broadcast composer (the `publications` table). The published feed
// now lives in the News Center (`NewsCenterPage`), so this page is a single
// centered compose card. Messages are recorded, not delivered.
//
// All copy goes through `useI18n()`; new English strings are added to the
// FRENCH map in `src/lib/i18n.ts`.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, insertPublication } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  NOTIFICATION_TYPE_LABELS,
  RECIPIENT_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
  RecipientType,
} from "@/pages/publications/publicationTypes";

const NOTIFICATION_TYPES = Object.keys(
  NOTIFICATION_TYPE_LABELS,
) as NotificationType[];
const RECIPIENT_TYPES = Object.keys(RECIPIENT_LABELS) as RecipientType[];
const MESSAGE_LIMIT = 600;

const FIELD_CLASS =
  "h-10 rounded-lg border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50";

const TYPE_ICONS = {
  urgent: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<NotificationType, typeof Info>;

export default function PublicationsPage() {
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientType[]>([]);
  const [notificationType, setNotificationType] =
    useState<NotificationType>("info");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const allRecipientsSelected = recipients.length === RECIPIENT_TYPES.length;

  const toggleRecipient = (value: RecipientType) => {
    setRecipients((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (publishing) return;
    setError(null);

    if (!title.trim() || !message.trim()) {
      setError(t("Please fill in the title and message."));
      return;
    }
    if (recipients.length === 0) {
      setError(t("Select at least one recipient."));
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

    setPublishing(true);
    try {
      await insertPublication(publication);
      setTitle("");
      setMessage("");
      setRecipients([]);
      setNotificationType("info");
      const names = publication.recipients
        .map((r) => t(RECIPIENT_LABELS[r]))
        .join(", ");
      setSuccessMessage(
        t("Announcement published to {recipients}.", { recipients: names }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">{t("Publications")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Create a publication to send to teachers and/or students. Messages are recorded but not actually delivered.",
        )}
      </p>

      <div className="mx-auto mt-6 max-w-3xl">
        {/* ------------------------------------------------------- composer */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-base font-semibold">{t("New Announcement")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Publish an update to the people who need it.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="publication-title">{t("Title")}</Label>
              <Input
                id="publication-title"
                placeholder={t("Enter announcement title")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="publication-message">{t("Message")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {message.length}/{MESSAGE_LIMIT}
                </span>
              </div>
              <Textarea
                id="publication-message"
                placeholder={t("Enter your message")}
                rows={5}
                maxLength={MESSAGE_LIMIT}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-lg border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Notification Type")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {NOTIFICATION_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const active = notificationType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setNotificationType(type)}
                      className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-medium transition-colors ${
                        active
                          ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {t(NOTIFICATION_TYPE_LABELS[type])}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("Recipients")}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={allRecipientsSelected}
                  onClick={() =>
                    setRecipients(
                      allRecipientsSelected ? [] : [...RECIPIENT_TYPES],
                    )
                  }
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    allRecipientsSelected
                      ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  {allRecipientsSelected ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {t("All")}
                </button>
                {RECIPIENT_TYPES.map((recipient) => {
                  const active = recipients.includes(recipient);
                  return (
                    <button
                      key={recipient}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleRecipient(recipient)}
                      className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                        active
                          ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                      {t(RECIPIENT_LABELS[recipient])}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </p>
            )}

            <Button
              type="submit"
              disabled={publishing}
              className="h-10 w-full rounded-lg border-transparent bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Send className="mr-2 h-4 w-4" />
              {publishing ? t("Publishing…") : t("Publish Announcement")}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
