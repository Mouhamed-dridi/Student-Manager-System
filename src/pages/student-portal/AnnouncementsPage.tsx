import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, Info, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listPublications, subscribeToTable } from "@/lib/api";
import { markAnnouncementsRead } from "@/lib/announcementReads";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useI18n } from "@/lib/i18n";
import {
  NOTIFICATION_TYPE_LABELS,
} from "@/pages/publications/publicationTypes";
import type {
  NotificationType,
  Publication,
} from "@/pages/publications/publicationTypes";

type FilterKey = "all" | NotificationType;

const ICONS: Record<NotificationType, LucideIcon> = {
  urgent: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const BADGE_STYLES: Record<NotificationType, string> = {
  urgent:
    "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold uppercase tracking-wider",
  warning:
    "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium",
  info: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300 font-medium",
};

function formatAnnouncementDate(iso: string, language: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnnouncementsPage() {
  const { language, t } = useI18n();
  const [announcements, setAnnouncements] = useState<Publication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const run = useCallback(() => {
    let cancelled = false;
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
  }, []);

  useEffect(() => {
    run();
    const unsubscribe = subscribeToTable("publications", () => {
      run();
    });
    return () => {
      unsubscribe();
    };
  }, [run]);

  useRefetchOnFocus(run);

  useEffect(() => {
    if (announcements) {
      markAnnouncementsRead(
        "students",
        announcements.map((p) => p.id),
      );
    }
  }, [announcements]);

  const hasUrgent = useMemo(
    () => announcements?.some((p) => p.type === "urgent") ?? false,
    [announcements],
  );

  const filterOptions = useMemo(() => {
    const list: { key: FilterKey; labelKey: string }[] = [
      { key: "all", labelKey: "All" },
      { key: "warning", labelKey: "Warnings" },
      { key: "info", labelKey: "Infos" },
    ];
    if (hasUrgent) {
      list.splice(1, 0, { key: "urgent", labelKey: "Urgent" });
    }
    return list;
  }, [hasUrgent]);

  const filtered = useMemo(() => {
    if (!announcements) return null;
    if (filter === "all") return announcements;
    return announcements.filter((p) => p.type === filter);
  }, [announcements, filter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{t("Announcements")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("Messages and news published to students.")}
          </p>
        </div>
        {filtered && (
          <span className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium tabular-nums text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {t("{count} announcements", { count: filtered.length })}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {/* Filter Chips */}
      {announcements && announcements.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filterOptions.map(({ key, labelKey }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(key)}
                className={`h-8 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-transparent bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {announcements === null ? (
        !error && <DataLoading label={t("Loading announcements…")} />
      ) : announcements.length === 0 ? (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <Megaphone className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium">{t("No announcements yet.")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Messages and news published to students.")}
          </p>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm font-medium">{t("No announcements match your filter.")}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered?.map((publication) => {
            const Icon = ICONS[publication.type] ?? Info;
            const badgeClass =
              BADGE_STYLES[publication.type] ?? BADGE_STYLES.info;

            return (
              <article
                key={publication.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
              >
                <div className="flex items-start gap-3.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {publication.title}
                        </h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeClass}`}
                        >
                          {t(NOTIFICATION_TYPE_LABELS[publication.type] ?? "Info / News")}
                        </span>
                      </div>
                      {publication.createdAt && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatAnnouncementDate(publication.createdAt, language)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {publication.message}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
