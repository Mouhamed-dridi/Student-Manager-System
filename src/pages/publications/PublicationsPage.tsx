// Operator broadcast composer (the `publications` table) as a two-column SaaS
// layout: compose on the left, the live feed of what has already been published
// on the right. The feed is searchable/filterable and subscribes to the
// `publications` realtime channel, so a message published from another browser
// appears without a reload. Messages are recorded, not delivered.
//
// All copy goes through `useI18n()`; new English strings are added to the
// FRENCH map in `src/lib/i18n.ts`.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Inbox,
  Info,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { DataError } from "@/components/DataState";
import {
  errorMessage,
  insertPublication,
  listPublications,
  softDeletePublication,
  subscribeToTable,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
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

const TYPE_ICONS = {
  urgent: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<NotificationType, typeof Info>;

/** Badge/filter tint per type: monochrome, differentiated by contrast. */
const TYPE_BADGE_CLASS: Record<NotificationType, string> = {
  urgent:
    "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950",
  warning:
    "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100",
  info: "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
};

const FIELD_CLASS =
  "h-10 rounded-lg border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50";

/** "5 min ago" / "il y a 5 min", falling back to a date for old posts. */
function relativeTime(iso: string, language: Language): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then) || then <= 0) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(
    language === "fr" ? "fr" : "en",
    { numeric: "auto", style: "narrow" },
  );
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(-days, "day");
  return new Date(then).toLocaleDateString(
    language === "fr" ? "fr-FR" : "en-US",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

export default function PublicationsPage() {
  const { language, t } = useI18n();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientType[]>([]);
  const [notificationType, setNotificationType] =
    useState<NotificationType>("info");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Feed state.
  const [publications, setPublications] = useState<Publication[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | NotificationType>("all");

  const refresh = useCallback(async () => {
    try {
      setPublications(await listPublications());
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  // Initial load mirrors the other pages: a promise chain rather than calling
  // `refresh()` in the effect body.
  useEffect(() => {
    listPublications()
      .then(setPublications)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  // Live feed: `publications` is in the realtime publication.
  useEffect(() => subscribeToTable("publications", () => void refresh()), [
    refresh,
  ]);

  useRefetchOnFocus(refresh);

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
      setSuccessMessage(t("Announcement published to {recipients}.", { recipients: names }));
      void refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setFeedError(null);
      await softDeletePublication(id);
      setPublications((prev) => prev?.filter((p) => p.id !== id) ?? prev);
    } catch (err) {
      setFeedError(errorMessage(err));
    }
  };

  const filtered = useMemo(() => {
    const rows = publications ?? [];
    const query = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!query) return true;
      return (
        p.title.toLowerCase().includes(query) ||
        p.message.toLowerCase().includes(query)
      );
    });
  }, [publications, search, typeFilter]);

  return (
    <div>
      <h2 className="text-2xl font-semibold">{t("Publications")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Create a publication to send to teachers and/or students. Messages are recorded but not actually delivered.",
        )}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ------------------------------------------------------- composer */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-5">
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

        {/* ------------------------------------------------------------ feed */}
        <section className="lg:col-span-7">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  {t("Published announcements")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {publications === null
                    ? t("Loading announcements…")
                    : t("{count} announcements", { count: filtered.length })}
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search announcements…")}
                aria-label={t("Search announcements…")}
                className={`${FIELD_CLASS} pl-9`}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", ...NOTIFICATION_TYPES] as const).map((value) => {
                const active = typeFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTypeFilter(value)}
                    className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                      active
                        ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {value === "all"
                      ? t("All types")
                      : t(NOTIFICATION_TYPE_LABELS[value])}
                  </button>
                );
              })}
            </div>

            {loadError && (
              <div className="mt-4">
                <DataError message={loadError} />
              </div>
            )}
            {feedError && (
              <div className="mt-4">
                <DataError message={feedError} />
              </div>
            )}

            <div className="mt-4 space-y-3">
              {publications === null && !loadError ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 px-6 py-14 text-center dark:border-zinc-800">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <Inbox className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <p className="mt-4 text-sm font-medium">
                    {publications?.length === 0
                      ? t("No announcements yet")
                      : t("No announcements match your search.")}
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    {publications?.length === 0
                      ? t("Announcements you publish will appear here.")
                      : t("Try a different search or filter.")}
                  </p>
                </div>
              ) : (
                filtered.map((publication) => (
                  <article
                    key={publication.id}
                    className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE_CLASS[publication.type]}`}
                        >
                          {t(NOTIFICATION_TYPE_LABELS[publication.type])}
                        </span>
                        {publication.recipients.map((recipient) => (
                          <span
                            key={recipient}
                            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                          >
                            {t(RECIPIENT_LABELS[recipient] ?? recipient)}
                          </span>
                        ))}
                        <span className="text-[11px] text-muted-foreground">
                          {relativeTime(publication.createdAt, language)}
                        </span>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("Delete publication")}
                              className="-mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("Delete publication?")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t(
                                "\"{title}\" will be moved to the Trash. You can restore it later or permanently delete from there.",
                                { title: publication.title },
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(publication.id)}
                            >
                              {t("Delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <h4 className="mt-3 text-sm font-semibold">
                      {publication.title}
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {publication.message}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
