import { Fragment, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
}

/** The event rows: cover, schedule, partners, participants and row actions. */
export function EventHistoryTable({
  events,
  teacherName,
  studentName,
  onEdit,
  onDelete,
}: EventHistoryTableProps) {
  /** Full "Name (link), Name" text for the cell tooltip, so a long list is still readable. */
  const partnersLabel = (partners: AppEvent["partners"]): string =>
    (partners ?? [])
      .map((partner) => {
        const label = partner.name || partner.link;
        return partner.link && partner.name ? `${label} (${partner.link})` : label;
      })
      .join(", ");

  const peopleDetail = (event: AppEvent): string => {
    const parts: string[] = [];
    if (event.organizers.length > 0) {
      parts.push(`Organizers: ${event.organizers.map(teacherName).join(", ")}`);
    }
    if (event.members.length > 0) {
      parts.push(`Members: ${event.members.map(studentName).join(", ")}`);
    }
    return parts.join(" · ");
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cover</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Partners</TableHead>
          <TableHead>People</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>
              {event.coverUrl ? (
                <img
                  src={event.coverUrl}
                  alt=""
                  className="h-10 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
                  <ImagePlus className="h-4 w-4" />
                </div>
              )}
            </TableCell>
            <TableCell className="font-medium">{event.title}</TableCell>
            <TableCell>{event.type}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDateRange(event.startsOn, event.endsOn)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatTime(event.eventTime)}
            </TableCell>
            <TableCell
              title={partnersLabel(event.partners)}
              className="max-w-[18rem]"
            >
              {event.partners?.length ? (
                event.partners.map((partner, index) => {
                  const href = asLink(partner.link);
                  // A partner with no name is a legacy row that stored a bare
                  // link, so fall back to showing the URL as the label.
                  const label = partner.name || partner.link;
                  return (
                    <Fragment key={`${partner.name}-${partner.link}-${index}`}>
                      {index > 0 && ", "}
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          title={partner.link}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="font-medium">{label}</span>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-xs" title={peopleDetail(event)}>
              {event.organizers.length + event.members.length === 0
                ? "—"
                : [
                    event.organizers.length > 0
                      ? `${event.organizers.length} organizer${
                          event.organizers.length === 1 ? "" : "s"
                        }`
                      : "",
                    event.members.length > 0
                      ? `${event.members.length} member${
                          event.members.length === 1 ? "" : "s"
                        }`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit"
                  onClick={() => onEdit(event)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete event?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &quot;{event.title}&quot; will be hidden from this list. The
                        row is kept in the database.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void onDelete(event)}>
                        Delete
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

  useEffect(() => {
    listTeachers()
      .then((rows) =>
        setTeachers(rows.map((t) => ({ id: t.id, fullName: t.fullName }))),
      )
      .catch(() => setTeachers([]));
    listStudents()
      .then((rows) =>
        setStudents(rows.map((s) => ({ id: s.id, fullName: s.fullName }))),
      )
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const teacherName = useMemo(() => {
    const map = new Map(teachers.map((t) => [t.id, t.fullName]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [teachers]);

  const studentName = useMemo(() => {
    const map = new Map(students.map((s) => [s.id, s.fullName]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [students]);

  const handleDelete = async (event: AppEvent) => {
    setError(null);
    try {
      await softDeleteEvent(event.id);
      refresh();
      setSuccessMessage(`"${event.title}" was deleted.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const totalPeople = (events ?? []).reduce(
    (sum, event) => sum + event.organizers.length + event.members.length,
    0,
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold">Event History</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every event and publication that has been created. Use{" "}
        <span className="font-medium">Edit</span> to change one, or{" "}
        <span className="font-medium">Events → New Event</span> to add another.
      </p>

      {loadError && (
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      )}

      {banner && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {banner}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {events === null ? (
        !loadError && (
          <div className="mt-4">
            <DataLoading label="Loading events…" />
          </div>
        )
      ) : events.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No events created yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Events you create will be listed here, with their cover image,
              schedule and participants.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-6">
            <EventHistoryTable
              events={events}
              teacherName={teacherName}
              studentName={studentName}
              onEdit={onEdit}
              onDelete={(event) => void handleDelete(event)}
            />
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {events.length} event{events.length === 1 ? "" : "s"}, {totalPeople}{" "}
            participant{totalPeople === 1 ? "" : "s"}. Organizers and members are
            stored as ids; names are resolved live.
          </p>
        </>
      )}
    </div>
  );
}
