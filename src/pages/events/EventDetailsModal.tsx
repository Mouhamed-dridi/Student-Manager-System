import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Gift,
  Handshake,
  ImagePlus,
  MapPin,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppEvent } from "@/lib/api";
import {
  asLink,
  eventTypeLabel,
  formatDateRange,
  formatTime,
  giftLabel,
  parseEventTime,
} from "./eventFormat";
import { useI18n } from "@/lib/i18n";

/**
 * The teacher's RSVP switches. Omitted on the student portal, which is
 * read-only over `events.attendees` (a uuid[] of teacher ids).
 */
export interface EventAttendanceAction {
  attending: boolean;
  count: number;
  busy: boolean;
  error?: string | null;
  onToggle: () => void;
}

/**
 * The one Event Details dialog for both portals: a card click anywhere opens
 * it. The poster stays uncropped (`object-contain`) because flyers are
 * documents and a cropped one loses the agenda printed at the bottom.
 *
 * Nothing here writes to `events` itself — the only write is the optional
 * attendance toggle, which goes through `setEventAttendance()` in the page.
 */
export default function EventDetailsModal({
  event,
  onClose,
  attendance,
}: {
  /** `null` closes the dialog; the page keeps the clicked row here. */
  event: AppEvent | null;
  onClose: () => void;
  attendance?: EventAttendanceAction;
}) {
  const { t, language } = useI18n();
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const type = eventTypeLabel(event?.type, t);
  const schedule = event
    ? formatDateRange(event.startsOn, event.endsOn, locale)
    : "—";
  const time = event ? formatTime(event.eventTime, locale) : "—";
  const timezone = event ? parseEventTime(event.eventTime).timezone : "";
  const rewards = event ? giftLabel(event.giftsAwards, t) : "";
  const location = event?.location?.trim() ?? "";
  const locationHref = asLink(location);

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Wide landscape sheet: poster on the left, everything readable on the
          right, and a pinned action bar so Close never scrolls away. */}
      <DialogContent className="box-border max-h-[92vh] w-[95vw] max-w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-w-3xl sm:p-0 lg:max-w-5xl">
        {event && (
          <div className="flex max-h-[92vh] min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                <div className="min-w-0">
                  {event.coverUrl ? (
                    <div className="flex max-h-[65vh] items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                      <img
                        src={event.coverUrl}
                        alt=""
                        className="max-h-[65vh] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-5">
                  <div className="space-y-2 pr-8">
                    {type && (
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {type}
                      </span>
                    )}
                    <DialogTitle className="text-xl font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                      {event.title}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {schedule === "—"
                          ? t("Date to be announced")
                          : schedule}
                      </span>
                      {event.eventTime && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {time}
                          </span>
                        </>
                      )}
                      {timezone && (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {timezone}
                        </span>
                      )}
                    </DialogDescription>
                  </div>

                  <section className="space-y-1.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t("About")}
                    </h4>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {event.description || t("No description provided.")}
                    </p>
                  </section>

                  {location && (
                    <section className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {t("Location")}
                      </h4>
                      {locationHref ? (
                        <a
                          href={locationHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
                        >
                          <MapPin className="h-4 w-4 shrink-0" />
                          {t("Open in Google Maps")}
                        </a>
                      ) : (
                        <p className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                          {location}
                        </p>
                      )}
                    </section>
                  )}

                  {rewards && (
                    <section className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {t("Gifts & awards")}
                      </h4>
                      <p className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                        {rewards}
                      </p>
                    </section>
                  )}

                  {event.partners.length > 0 && (
                    <section className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {t("Partners")}
                      </h4>
                      <ul className="space-y-1">
                        {event.partners.map((partner, index) => {
                          const href = asLink(partner.link);
                          // A partner with no name is a legacy row that stored
                          // a bare link, so the URL doubles as the label.
                          const label = partner.name || partner.link;
                          return (
                            <li
                              key={`${partner.name}-${partner.link}-${index}`}
                              className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300"
                            >
                              <Handshake className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={partner.link}
                                  className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
                                >
                                  {label}
                                </a>
                              ) : (
                                <span className="font-medium">{label}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                {attendance ? (
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Users className="h-4 w-4" />
                    {t("{count} attending", { count: attendance.count })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <CalendarDays className="h-4 w-4" />
                    {schedule === "—" ? t("Date to be announced") : schedule}
                  </span>
                )}
                {attendance?.error && (
                  <p className="mt-1 max-w-md text-xs text-zinc-600 dark:text-zinc-400">
                    {attendance.error}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  {t("Close")}
                </Button>
                {attendance && (
                  <Button
                    onClick={attendance.onToggle}
                    disabled={attendance.busy}
                    variant={attendance.attending ? "outline" : "default"}
                  >
                    {attendance.attending ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t("Attending")}
                      </>
                    ) : attendance.busy ? (
                      t("Saving…")
                    ) : (
                      t("Join")
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
