import { useEffect, useState } from "react";
import { Gift, ImagePlus, MapPin, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listEvents, type AppEvent } from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import {
  formatDateRange,
  formatGift,
  formatTime,
} from "@/pages/events/eventFormat";

// Student view of the events the operator publishes (hackathons, new trainings,
// certifications…). Read-only: joining an event stays a teacher-portal action
// (`events.attendees`), so the cards only show what is scheduled.
//
// All colours come from shadcn tokens (bg-card, text-muted-foreground, …) so the
// grid follows the shared dark-mode setting without a second style sheet.
export default function StudentEventsView() {
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <h2 className="text-2xl font-semibold">Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hackathons, trainings and ceremonies published by the school.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {events === null
            ? ""
            : `${events.length} event${events.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="mt-4">
        {error ? (
          <DataError message={error} />
        ) : events === null ? (
          <DataLoading label="Loading events…" />
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Ticket className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No event has been published yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const gifts = formatGift(event.giftsAwards);
              const schedule = formatDateRange(event.startsOn, event.endsOn);
              const time = formatTime(event.eventTime);
              return (
                <Card key={event.id} className="flex flex-col pt-0">
                  <div className="relative aspect-video w-full shrink-0 bg-muted">
                    {event.coverUrl ? (
                      <img
                        src={event.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                    {event.type ? (
                      <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                        {event.type}
                      </span>
                    ) : null}
                  </div>

                  <CardHeader>
                    <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                    <p className="text-sm font-medium text-foreground">
                      {schedule}
                      {time && time !== "—" ? ` · ${time}` : ""}
                    </p>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-2">
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {event.description || "No description provided."}
                    </p>
                    {gifts ? (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Gift className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{gifts}</span>
                      </p>
                    ) : null}
                    {event.location?.trim() ? (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{event.location}</span>
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
