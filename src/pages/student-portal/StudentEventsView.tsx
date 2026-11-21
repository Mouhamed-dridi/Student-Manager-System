import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Gift,
  Handshake,
  ImagePlus,
  MapPin,
  Ticket,
} from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listEvents, type AppEvent } from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  formatDateRange,
  formatTime,
  GIFT_OPTIONS,
  splitGifts,
} from "@/pages/events/eventFormat";
import { formatPersonName } from "@/lib/format";
import { useI18n, type Translate } from "@/lib/i18n";

/**
 * `events.type` is free text with no CHECK, so the known creator options get a
 * dictionary key while anything else keeps its stored shape.
 */
const EVENT_TYPE_KEYS: Record<string, string> = {
  event: "Event",
  workshop: "Workshop",
  hackathon: "Hackathon",
  talks: "Talks",
  publication: "Publication",
  "new training": "New Training",
  certification: "Certification",
};

/** Localized label for a stored event type ("talks" → "Conférence"). */
function eventTypeLabel(
  type: string | null | undefined,
  translate: Translate,
): string {
  const raw = (type ?? "").trim();
  if (!raw) return "";
  const known = EVENT_TYPE_KEYS[raw.toLowerCase()];
  if (known) return translate(known);
  // Only re-case values stored fully lower/upper case, so a custom type such
  // as "AI Summit" keeps its acronym instead of becoming "Ai Summit".
  const uniformCase = raw === raw.toLowerCase() || raw === raw.toUpperCase();
  return uniformCase ? formatPersonName(raw) : raw;
}

/** Localized reward labels ("money, gadget" → "Argent, Gadget"). */
function giftLabel(value: string, translate: Translate): string {
  return splitGifts(value)
    .map((part) => {
      const option = GIFT_OPTIONS.find(
        (entry) => entry.value === part.toLowerCase(),
      );
      return translate(option?.label ?? part);
    })
    .join(", ");
}

// Student view of the events the operator publishes (hackathons, new trainings,
// certifications…). Read-only: joining an event stays a teacher-portal action
// (`events.attendees`), so the cards only show what is scheduled.
//
// Strict zinc palette (no coloured tokens) so the grid matches the active
// light/dark theme exactly like the rest of the student workspace.
export default function StudentEventsView() {
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";

  useEffect(() => {
    listEvents()
      .then((rows) => {
        setEvents(rows);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Coming back to the tab after a while re-reads the list, like the other
  // student pages; there is no realtime subscription for this table.
  useRefetchOnFocus(() => {
    listEvents()
      .then((rows) => {
        setEvents(rows);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Events")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "Hackathons, trainings and ceremonies published by the school.",
            )}
          </p>
        </div>
        {events !== null && (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t(events.length === 1 ? "{count} event" : "{count} events", {
              count: events.length,
            })}
          </span>
        )}
      </div>

      <div className="mt-4">
        {error ? (
          <DataError message={error} />
        ) : events === null ? (
          <DataLoading label={t("Loading events…")} />
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <Ticket className="mx-auto h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("No event has been published yet.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const type = eventTypeLabel(event.type, t);
              const schedule = formatDateRange(
                event.startsOn,
                event.endsOn,
                locale,
              );
              const time = formatTime(event.eventTime, locale);
              const hasTime = time !== "—";
              const rewards = giftLabel(event.giftsAwards, t);
              const partners = (event.partners ?? [])
                .map((partner) => partner.name?.trim() || partner.link?.trim())
                .filter(Boolean)
                .join(", ");
              const location = event.location?.trim() ?? "";
              const hasMeta = Boolean(rewards || partners || location);

              return (
                <article
                  key={event.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                >
                  <div className="aspect-[16/10] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    {event.coverUrl ? (
                      <img
                        src={event.coverUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3
                      className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100"
                      title={event.title}
                    >
                      {event.title}
                    </h3>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {type && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                          {type}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {schedule === "—" ? t("Date to be announced") : schedule}
                      </span>
                      {hasTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {time}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {event.description || t("No description provided.")}
                    </p>

                    {hasMeta && (
                      <div className="mt-auto flex flex-col gap-1.5 border-t border-zinc-100 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                        {rewards && (
                          <p className="flex min-w-0 items-center gap-1.5">
                            <Gift className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                            <span className="truncate" title={rewards}>
                              {rewards}
                            </span>
                          </p>
                        )}
                        {partners && (
                          <p className="flex min-w-0 items-center gap-1.5">
                            <Handshake className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                            <span className="truncate" title={partners}>
                              {partners}
                            </span>
                          </p>
                        )}
                        {location && (
                          <p className="flex min-w-0 items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                            <span className="truncate" title={location}>
                              {location}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
