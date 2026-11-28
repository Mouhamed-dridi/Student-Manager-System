import { useEffect, useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  listEvents,
  setEventAttendance,
  subscribeToTable,
  type AppEvent,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { EventCardGrid } from "@/pages/events/EventCard";
import EventDetailsModal from "@/pages/events/EventDetailsModal";
import { loadCurrentTeacher } from "./currentTeacher";

/**
 * The teacher's event index. Read-only over `events`: an event only comes into
 * existence through the operator's New Event form, and the only write here is
 * the attendance toggle (`events.attendees`).
 *
 * Both portals share the card grid and the details dialog, so a card click
 * opens `EventDetailsModal` instead of swapping in a full-page section.
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

export default function TeacherEventsPage() {
  // null = still loading; the DataError below takes over if the load failed.
  const [events, setEvents] = useState<AppEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The clicked card, kept as an id so a realtime refresh re-renders the open
  // dialog with the newest row instead of a stale snapshot.
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The RSVP lives on the server, so this local list is what the Join button
  // optimistically updates; the next realtime `events` change is authoritative.
  const [attendees, setAttendees] = useState<string[] | null>(null);
  const { t } = useI18n();

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

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then((teacher) => !cancelled && setTeacherId(teacher?.id ?? ""))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () => (events ?? []).slice().sort(byRelevance),
    [events],
  );
  const openEvent = useMemo(
    () => sorted.find((event) => event.id === openEventId) ?? null,
    [sorted, openEventId],
  );

  const openDetails = (event: AppEvent) => {
    setOpenEventId(event.id);
    setAttendees(event.attendees);
    setActionError(null);
  };

  const closeDetails = () => {
    setOpenEventId(null);
    setAttendees(null);
    setActionError(null);
  };

  const currentAttendees = attendees ?? openEvent?.attendees ?? [];
  const joined = Boolean(teacherId) && currentAttendees.includes(teacherId);

  const toggleAttendance = async () => {
    if (!openEvent) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await setEventAttendance(openEvent.id, teacherId, !joined);
      setAttendees(next);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
        {loadError ? (
          <DataError message={loadError} />
        ) : events === null ? (
          <DataLoading label={t("Loading events…")} />
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <Ticket className="mx-auto h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("No event has been published yet.")}
            </p>
          </div>
        ) : (
          <EventCardGrid events={sorted} onOpen={openDetails} />
        )}
      </div>

      <EventDetailsModal
        event={openEvent}
        onClose={closeDetails}
        attendance={
          openEvent
            ? {
                attending: joined,
                count: currentAttendees.length,
                busy,
                error: actionError,
                onToggle: () => void toggleAttendance(),
              }
            : undefined
        }
      />
    </div>
  );
}
