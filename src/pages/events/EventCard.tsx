import {
  CalendarDays,
  Clock,
  Gift,
  Handshake,
  ImagePlus,
  MapPin,
} from "lucide-react";
import type { AppEvent } from "@/lib/api";
import {
  eventTypeLabel,
  formatDateRange,
  formatTime,
  giftLabel,
  partnerNames,
} from "./eventFormat";
import { useI18n } from "@/lib/i18n";

/**
 * One event card. Both portals render this exact card, which is why it is a
 * `<button>`: clicking anywhere opens the details modal and Enter/Space work
 * without extra key handling. Text is left-aligned because a button's default
 * centring would break the layout.
 */
export function EventCard({
  event,
  onOpen,
}: {
  event: AppEvent;
  onOpen: () => void;
}) {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const type = eventTypeLabel(event.type, t);
  const schedule = formatDateRange(event.startsOn, event.endsOn, locale);
  const time = formatTime(event.eventTime, locale);
  const hasTime = time !== "—";
  const rewards = giftLabel(event.giftsAwards, t);
  const partners = partnerNames(event);
  const location = event.location?.trim() ?? "";
  const hasMeta = Boolean(rewards || partners || location);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition-colors hover:border-zinc-300 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-500/40"
    >
      <div className="aspect-video w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
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
    </button>
  );
}

/** The responsive card grid shared by the student and teacher event pages. */
export function EventCardGrid({
  events,
  onOpen,
}: {
  events: AppEvent[];
  onOpen: (event: AppEvent) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpen={() => onOpen(event)} />
      ))}
    </div>
  );
}
