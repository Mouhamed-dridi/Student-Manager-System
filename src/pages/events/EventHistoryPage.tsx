import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ImagePlus,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listEvents,
  listStudents,
  listTeachers,
  softDeleteEvent,
  subscribeToTable,
  type AppEvent,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { asLink, formatDateRange, formatTime } from "./eventFormat";

interface EventHistoryPageProps {
  /** Handed the event to edit; the layout switches to the form page. */
  onEdit: (event: AppEvent) => void;
  /**
   * Confirmation shown after the form saves, because saving redirects here. The
   * layout owns the text and clears it on a timer.
   */
  notice?: string | null;
}

interface EventHistoryTableProps {
  events: AppEvent[];
  /** id -> display name, for the organizer/member tooltip. */
  teacherName: (id: string) => string;
  studentName: (id: string) => string;
  onEdit: (event: AppEvent) => void;
  onDelete: (event: AppEvent) => void;
  /** `en-US` / `fr-FR`, so the schedule column follows the app language. */
  locale?: string;
  /** Bottom summary bar rendered inside the table card. */
  summary?: ReactNode;
}

/**
 * `events.type` is free text with no CHECK, so the known creator options get a
 * dictionary key while anything else keeps its stored shape.
 */
const EVENT_TYPE_KEYS: Record<string, string> = {
  event: "Event",
  workshop: "Workshop",
  hackathon: "Hackathon",
  talks: "Talks",
};

/** Localized label for a stored event type ("talks" → "Conférence"). */
function eventTypeLabel(
  type: string | null | undefined,
  translate: (key: string) => string,
): string {
  const raw = (type ?? "").trim();
  if (!raw) return "—";
  const known = EVENT_TYPE_KEYS[raw.toLowerCase()];
  if (known) return translate(known);
  // Only re-case values that were stored fully lower/upper case, so a custom
  // type such as "AI Summit" keeps its acronym instead of "Ai Summit".
  const uniformCase = raw === raw.toLowerCase() || raw === raw.toUpperCase();
  return uniformCase ? formatPersonName(raw) : raw;
}

/** Normalized key so the filter pills match regardless of stored casing. */
function typeKeyOf(type: string | null | undefined): string {
  return (type ?? "").trim().toLowerCase();
}

/** Monochrome zinc pill shared by the table cell and the filter bar. */
function typePillClass(selected = false): string {
  return cn(
    "inline-flex items-center rounded-full border font-medium whitespace-nowrap transition-colors",
    selected
      ? "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
      : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  );
}

/** The event rows: cover, schedule, partners, participants and row actions. */
export function EventHistoryTable({
  events,
  teacherName,
  studentName,
  onEdit,
  onDelete,
  locale,
  summary,
}: EventHistoryTableProps) {
  const t = useT();

  /** Full "Name (link), Name" text for the cell tooltip, so a long list is still readable. */
  const partnersLabel = (partners: AppEvent["partners"]): string =>
    (partners ?? [])
      .map((partner) => {
        const label = partner.name
          ? formatPersonName(partner.name)
          : partner.link;
        return partner.link && partner.name ? `${label} (${partner.link})` : label;
      })
      .join(", ");

  const peopleDetail = (event: AppEvent): string => {
    const parts: string[] = [];
    if (event.organizers.length > 0) {
      parts.push(
        t("Organizers: {names}", {
          names: event.organizers.map(teacherName).join(", "),
        }),
      );
    }
    if (event.members.length > 0) {
      parts.push(
        t("Members: {names}", {
          names: event.members.map(studentName).join(", "),
        }),
      );
    }
    return parts.join(" · ");
  };

  const peopleSummary = (event: AppEvent): string =>
    [
      event.organizers.length > 0
        ? `${event.organizers.length} ${
            event.organizers.length === 1 ? t("organizer") : t("organizers")
          }`
        : "",
      event.members.length > 0
        ? `${event.members.length} ${
            event.members.length === 1 ? t("member") : t("members")
          }`
        : "",
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/60">
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Cover")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Title")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Type")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Dates")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Time")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Partners")}
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("People")}
            </TableHead>
            <TableHead className="w-24 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow
              key={event.id}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
            >
              <TableCell>
                {event.coverUrl ? (
                  <img
                    src={event.coverUrl}
                    alt=""
                    className="h-10 w-16 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-16 items-center justify-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                )}
              </TableCell>
              <TableCell
                title={event.title}
                className="font-medium text-zinc-900 dark:text-zinc-100"
              >
                <div className="max-w-[18rem] truncate">{event.title}</div>
              </TableCell>
              <TableCell>
                <span className={cn(typePillClass(), "h-6 px-2 text-[11px]")}>
                  {eventTypeLabel(event.type, t)}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                {formatDateRange(event.startsOn, event.endsOn, locale)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                {formatTime(event.eventTime, locale)}
              </TableCell>
              <TableCell
                title={partnersLabel(event.partners)}
                className="max-w-[18rem] text-zinc-700 dark:text-zinc-300"
              >
                <div className="truncate">
                  {event.partners?.length ? (
                    event.partners.map((partner, index) => {
                      const href = asLink(partner.link);
                      // A partner with no name is a legacy row that stored a
                      // bare link, so fall back to showing the URL as the label.
                      const label = partner.name
                        ? formatPersonName(partner.name)
                        : partner.link;
                      return (
                        <Fragment
                          key={`${partner.name}-${partner.link}-${index}`}
                        >
                          {index > 0 && ", "}
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              title={partner.link}
                              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                            >
                              {label}
                            </a>
                          ) : (
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {label}
                            </span>
                          )}
                        </Fragment>
                      );
                    })
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-600">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell
                className="text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                title={peopleDetail(event)}
              >
                {event.organizers.length + event.members.length === 0
                  ? "—"
                  : peopleSummary(event)}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t("Edit")}
                    aria-label={t("Edit")}
                    className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    onClick={() => onEdit(event)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Delete event")}
                          aria-label={t("Delete event")}
                          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("Delete event?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t(
                            "{name} will be hidden from this list. The row is kept in the database.",
                            { name: event.title },
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onDelete(event)}>
                          {t("Delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {summary && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {summary}
        </div>
      )}
    </div>
  );
}

/**
 * The dedicated "Event History" view: every event that has been created, with
 * its cover, schedule, partners and participants, plus edit and delete. The
 * creation form lives on its own page, so each of the two has a single job.
 */
export default function EventHistoryPage({
  onEdit,
  notice,
}: EventHistoryPageProps) {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Delete confirmation, local to this page. The post-save confirmation arrives
  // as `notice` because saving happens on the form page and redirects here.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const banner = notice ?? successMessage;

  // Rosters are only needed to turn the stored organizer/member ids into names
  // for the tooltip. Ids that no longer resolve (a trashed person) are skipped.
  const [teachers, setTeachers] = useState<{ id: string; fullName: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const refresh = () => {
    listEvents()
      .then(setEvents)
      .catch((err) => setLoadError(errorMessage(err)));
  };

  useEffect(() => {
    refresh();
    return subscribeToTable("events", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime is the primary sync; this covers a socket that dropped while the
  // tab was in the background, like the other operator pages.
  useRefetchOnFocus(refresh);

  useEffect(() => {
    listTeachers()
      .then((rows) =>
        setTeachers(rows.map((row) => ({ id: row.id, fullName: row.fullName }))),
      )
      .catch(() => setTeachers([]));
    listStudents()
      .then((rows) =>
        setStudents(rows.map((row) => ({ id: row.id, fullName: row.fullName }))),
      )
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const teacherName = useMemo(() => {
    const map = new Map(teachers.map((row) => [row.id, row.fullName]));
    return (id: string) => map.get(id) ?? t("Unknown");
  }, [teachers, t]);

  const studentName = useMemo(() => {
    const map = new Map(students.map((row) => [row.id, row.fullName]));
    return (id: string) => map.get(id) ?? t("Unknown");
  }, [students, t]);

  const handleDelete = async (event: AppEvent) => {
    setError(null);
    try {
      await softDeleteEvent(event.id);
      refresh();
      setSuccessMessage(t("{name} was deleted.", { name: event.title }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Filter pills: only the types actually present, in first-seen order.
  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const event of events ?? []) {
      const key = typeKeyOf(event.type);
      if (!key || seen.has(key)) continue;
      seen.set(key, eventTypeLabel(event.type, t));
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [events, t]);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (events ?? []).filter((event) => {
      if (typeFilter !== "all" && typeKeyOf(event.type) !== typeFilter) {
        return false;
      }
      if (!term) return true;
      const haystack = [
        event.title,
        event.type,
        eventTypeLabel(event.type, t),
        ...(event.partners ?? []).flatMap((partner) => [
          partner.name,
          partner.link,
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [events, query, typeFilter, t]);

  // The summary bar reflects the rows on screen, so filtering never leaves a
  // participant count that belongs to hidden events.
  const visiblePeople = filteredEvents.reduce(
    (sum, event) => sum + event.organizers.length + event.members.length,
    0,
  );
  const filtered = filteredEvents.length !== (events ?? []).length;

  return (
    <div className="text-zinc-900 dark:text-zinc-100">
      <h2 className="text-2xl font-semibold">{t("Event History")}</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {t(
          "Every event that has been created. Use Edit to change one, or Events → New Event to add another.",
        )}
      </p>

      {loadError && (
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      )}

      {banner && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          {banner}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{error}</p>
      )}

      {events === null ? (
        !loadError && (
          <div className="mt-4">
            <DataLoading label={t("Loading events…")} />
          </div>
        )
      ) : events.length === 0 ? (
        <Card className="mt-4 max-w-xl border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {t("No events created yet")}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t(
                "Events you create will be listed here, with their cover image, schedule and participants.",
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* search + type filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Search by title, partner or type…")}
                aria-label={t("Search by title, partner or type…")}
                className="h-9 border-zinc-200 bg-white pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:border-zinc-500 focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus-visible:border-zinc-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
                className={cn(
                  typePillClass(typeFilter === "all"),
                  "h-8 px-3 text-xs",
                )}
              >
                {t("All")}
              </button>
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={typeFilter === option.value}
                  onClick={() => setTypeFilter(option.value)}
                  className={cn(
                    typePillClass(typeFilter === option.value),
                    "h-8 px-3 text-xs",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {filteredEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                {t("No events match your search.")}
              </div>
            ) : (
              <EventHistoryTable
                events={filteredEvents}
                teacherName={teacherName}
                studentName={studentName}
                onEdit={onEdit}
                onDelete={(event) => void handleDelete(event)}
                locale={locale}
                summary={
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {filtered
                        ? t("{shown} of {total} events shown", {
                            shown: filteredEvents.length,
                            total: events.length,
                          })
                        : `${events.length} ${
                            events.length === 1 ? t("event") : t("events")
                          }`}
                    </span>
                    <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                      ·
                    </span>
                    <span>
                      {visiblePeople}{" "}
                      {visiblePeople === 1
                        ? t("participant")
                        : t("participants")}
                    </span>
                    <span
                      aria-hidden
                      className="hidden text-zinc-300 sm:inline dark:text-zinc-700"
                    >
                      ·
                    </span>
                    <span className="hidden sm:inline">
                      {t(
                        "Organizers and members are stored as ids; names are resolved live.",
                      )}
                    </span>
                  </>
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
