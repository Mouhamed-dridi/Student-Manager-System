import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, ImagePlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listEvents,
  setEventAttendance,
  subscribeToTable,
  type AppEvent,
} from "@/lib/api";
import { asLink, formatDateRange, formatTime } from "../events/eventFormat";
import { loadCurrentTeacher } from "./currentTeacher";

/**
 * Full-screen event details for the teacher portal, reached by clicking a card
 * on TeacherEventsPage.
 *
 * A section rather than a route: the teacher portal keeps every screen behind
 * the single `/teacher` route and swaps with useState, so adding
 * `/teacher/events/:id` would be the only nested route in the app and would
 * need its own guard in App.tsx. `onBack` returns to the index.
 */
export default function TeacherEventDetailPage({
  eventId,
  onBack,
}: {
  eventId: string;
  onBack: () => void;
}) {
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The RSVP lives on the server, so the local count is what the Join button
  // optimistically bumps; a realtime `events` change overwrites it.
  const [attendees, setAttendees] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then((t) => !cancelled && setTeacherId(t?.id ?? ""))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback((rows: AppEvent[]) => {
    const found = rows.find((e) => e.id === eventId) ?? null;
    setEvent(found);
    setAttendees(found ? found.attendees : null);
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listEvents()
        .then((rows) => {
          if (cancelled) return;
          apply(rows);
          setLoadError(null);
        })
        .catch((err) => {
          if (!cancelled) setLoadError(errorMessage(err));
        });
    load();
    const off = subscribeToTable("events", load);
    return () => {
      cancelled = true;
      off();
    };
  }, [apply]);

  const joined = Boolean(teacherId) && (attendees ?? []).includes(teacherId);

  if (loadError) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      </div>
    );
  }

  if (event === undefined) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <div className="mt-4">
          <DataLoading label="Loading event…" />
        </div>
      </div>
    );
  }

  if (event === null) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">Event not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been removed by the center.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Defined after the guards so `event` is narrowed to AppEvent, not
  // AppEvent | null | undefined.
  const toggle = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await setEventAttendance(event.id, teacherId, !joined);
      setAttendees(next);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <BackButton onBack={onBack} />

      {/* Poster and details side by side on wide screens; poster capped so a
          tall poster cannot push the description off the first screen. */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-0 lg:self-start">
          {event.coverUrl ? (
            <img
              src={event.coverUrl}
              alt=""
              className="max-h-[70vh] w-full rounded-xl bg-muted object-contain ring-1 ring-foreground/10"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-foreground/10">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <header className="space-y-2">
            <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {event.type}
            </span>
            <h2 className="text-2xl font-semibold leading-tight">{event.title}</h2>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDateRange(event.startsOn, event.endsOn)}
              </span>
              {event.eventTime && (
                <span aria-hidden="true">·</span>
              )}
              {event.eventTime && <span>{formatTime(event.eventTime)}</span>}
            </p>
          </header>

          {event.description && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">About</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {event.description}
              </p>
            </section>
          )}

          {event.giftsAwards && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Gifts &amp; awards</h3>
              <p className="text-sm text-muted-foreground">{event.giftsAwards}</p>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Partners</h3>
            {event.partners.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5">
                {event.partners.map((partner, index) => {
                  const href = asLink(partner.link);
                  // A partner with no name is a legacy row that stored a bare
                  // link, so the URL doubles as the label.
                  const label = partner.name || partner.link;
                  return (
                    <li key={`${partner.name}-${partner.link}-${index}`}>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          title={partner.link}
                          className="text-sm font-medium underline-offset-2 hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="text-sm font-medium">{label}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {(attendees ?? event.attendees).length} attending
            </span>
            <Button
              onClick={() => void toggle()}
              disabled={busy}
              variant={joined ? "outline" : "default"}
            >
              {joined ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Attending
                </>
              ) : busy ? (
                "Saving…"
              ) : (
                "Join"
              )}
            </Button>
          </section>

          {actionError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onBack}>
      <ArrowLeft className="h-4 w-4" />
      Back to Events
    </Button>
  );
}
