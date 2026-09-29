import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ImagePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listEvents,
  subscribeToTable,
  type AppEvent,
} from "@/lib/api";
import { formatDateRange } from "../events/eventFormat";

/**
 * The teacher's event index. Read-only: an event only comes into existence
 * through the operator's New Event form, so this page shows and nothing more.
 * Opening a card hands the event id to the layout, which swaps in
 * TeacherEventDetailPage (a section, not a route — the teacher portal keeps
 * every screen behind one `/teacher` route).
 */

/** Today's date as yyyy-mm-dd from LOCAL parts.
 *
 * `toISOString()` would give the UTC date, which is a different day for anyone
 * west of Greenwich in the evening — the same off-by-one that formatDay()
 * documents. `starts_on`/`ends_on` are bare date strings with no timezone, so
 * they have to be compared against a local "today".
 */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Upcoming first, then ongoing, then past, then undated last. */
function byRelevance(a: AppEvent, b: AppEvent): number {
  const today = localToday();
  const phase = (event: AppEvent) => {
    if (!event.startsOn) return 3;
    if (event.startsOn > today) return 0;
    if (!event.endsOn || event.endsOn >= today) return 1;
    return 2;
  };
  const diff = phase(a) - phase(b);
  if (diff !== 0) return diff;
  // Within the same phase, the nearest date leads; undated rows keep a stable
  // order because listEvents already sorts them newest-created first.
  if (a.startsOn && b.startsOn) return a.startsOn.localeCompare(b.startsOn);
  if (a.startsOn) return -1;
  if (b.startsOn) return 1;
  return 0;
}

/** The poster. `object-contain` so nothing is cropped: posters are vertical
 *  documents and a cropped one loses the agenda printed at the bottom. */
function EventPoster({ event }: { event: AppEvent }) {
  return event.coverUrl ? (
    <img
      src={event.coverUrl}
      alt=""
      className="aspect-[3/4] w-full bg-muted object-contain"
    />
  ) : (
    <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground">
      <ImagePlus className="h-5 w-5" />
    </div>
  );
}

function EventCard({
  event,
  onOpen,
}: {
  event: AppEvent;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <EventPoster event={event} />

      {/* Footer: hairline divider, even padding, one element per row so the
          badge, title and date never compete for the same line. */}
      <div className="flex flex-1 flex-col gap-2.5 border-t border-foreground/10 p-4">
        <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {event.type}
        </span>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <span className="group-hover:underline">{event.title}</span>
        </h3>

        <p className="mt-auto flex items-center gap-1.5 border-t border-foreground/5 pt-2.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {formatDateRange(event.startsOn, event.endsOn)}
        </p>
      </div>
    </button>
  );
}

export default function TeacherEventsPage({
  onOpenEvent,
}: {
  onOpenEvent: (eventId: string) => void;
}) {
  // null = still loading; the DataError below takes over if the load failed.
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listEvents()
        .then((rows) => {
          if (!cancelled) {
            setEvents(rows);
            setLoadError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setLoadError(errorMessage(err));
        });
    load();
    // The operator creating an event on another screen shows up here live.
    const off = subscribeToTable("events", load);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const sorted = useMemo(() => (events ?? []).slice().sort(byRelevance), [events]);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Events</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Center events and publications. Open one to see the full poster and
        details, and to register as attending.
      </p>

      {loadError && (
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      )}

      {sorted.length === 0 ? (
        events === null && !loadError ? (
          <div className="mt-4">
            <DataLoading label="Loading events…" />
          </div>
        ) : (
          <Card className="mt-4 max-w-xl">
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">No events yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Events created by the center will be listed here, with their
                poster, schedule and partners.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onOpen={() => onOpenEvent(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
