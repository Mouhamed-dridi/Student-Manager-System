import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listEvents, type AppEvent } from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useI18n } from "@/lib/i18n";
import { EventCardGrid } from "@/pages/events/EventCard";
import EventDetailsModal from "@/pages/events/EventDetailsModal";

// Student view of the events the operator publishes (hackathons, new trainings,
// certifications…). Read-only: joining an event stays a teacher-portal action
// (`events.attendees`), so the cards open the shared details dialog without an
// RSVP action.
//
// The card grid and the dialog are shared with the teacher portal
// (EventCard.tsx / EventDetailsModal.tsx) so both portals stay identical.
export default function StudentEventsView() {
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The clicked card; `null` keeps the details dialog closed.
  const [openEvent, setOpenEvent] = useState<AppEvent | null>(null);
  const { t } = useI18n();

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
          <EventCardGrid events={events} onOpen={setOpenEvent} />
        )}
      </div>

      <EventDetailsModal event={openEvent} onClose={() => setOpenEvent(null)} />
    </div>
  );
}
