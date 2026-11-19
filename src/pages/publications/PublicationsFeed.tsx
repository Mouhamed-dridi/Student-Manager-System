// The "Published announcements" feed: a searchable/filterable card list of
// everything in the `publications` table, with edit and delete actions.
// It used to be the right-hand column of the Publications composer; it now
// renders full width in the News Center. Subscribes to the `publications`
// realtime channel, so a message published from another browser appears
// without a reload. Messages are recorded, not delivered.
//
// All copy goes through `useI18n()`; new English strings are added to the
// FRENCH map in `src/lib/i18n.ts`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/pages/publications/publicationTypes";
import EditPublicationDialog from "@/pages/publications/EditPublicationDialog";

const NOTIFICATION_TYPES = Object.keys(
  NOTIFICATION_TYPE_LABELS,
) as NotificationType[];

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

export default function PublicationsFeed() {
  const { language, t } = useI18n();

  const [publications, setPublications] = useState<Publication[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | NotificationType>("all");
  const [editing, setEditing] = useState<Publication | null>(null);

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
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
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

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Edit publication")}
                    onClick={() => setEditing(publication)}
                    className="-mt-1 h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
              </div>

              <h4 className="mt-3 text-sm font-semibold">{publication.title}</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {publication.message}
              </p>
            </article>
          ))
        )}
      </div>

      {editing && (
        <EditPublicationDialog
          publication={editing}
          onSaved={() => void refresh()}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
