import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Globe,
  ImagePlus,
  Loader2,
  Plus,
  Users,
  X,
} from "lucide-react";
import PeopleMultiSelect from "@/components/PeopleMultiSelect";
import {
  errorMessage,
  listStudents,
  listTeachers,
  saveEvent,
  uploadEventCover,
  type AppEvent,
  type EventPartner,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  GIFT_OPTIONS,
  composeEventTime,
  formatDay,
  formatTime,
  parseEventTime,
} from "./eventFormat";

/** The four kinds of event the creator offers. Stored as free text. */
const EVENT_TYPE_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "workshop", label: "Workshop" },
  { value: "hackathon", label: "Hackathon" },
  { value: "talks", label: "Talks" },
] as const;

/**
 * A short, practical timezone list. The browser's own zone is prepended at
 * render time, so the default is always present even when it is not listed.
 */
const TIMEZONE_OPTIONS = [
  "UTC",
  "Africa/Casablanca",
  "Africa/Algiers",
  "Africa/Tunis",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const COVER_MAX_WIDTH = 800;

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Downscales a picked cover to a <=800px JPEG. Keeps the stored object small
 * and guarantees a predictable content type for the Storage upload.
 */
async function fileToCoverJpeg(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image could not be decoded"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, COVER_MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image could not be encoded")),
      "image/jpeg",
      0.8,
    ),
  );
}

export interface EventsViewProps {
  /** Pre-fills the form to update an existing event instead of creating one. */
  initialEvent?: AppEvent | null;
  /** Back button handler to return to previous event view or list. */
  onBack?: () => void;
  /** Callback fired after saving the event. */
  onSaved?: (saved: AppEvent, wasUpdate: boolean) => void;
}

/**
 * Full Page Meetup/Luma-style event creator view.
 *
 * Renders inline inside the dashboard content area with a 2-column layout.
 */
export default function EventsView({
  initialEvent,
  onBack,
  onSaved,
}: EventsViewProps) {
  const initialTime = useMemo(
    () => parseEventTime(initialEvent?.eventTime ?? ""),
    [initialEvent],
  );

  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [type, setType] = useState(initialEvent?.type || "event");
  const [description, setDescription] = useState(
    initialEvent?.description ?? "",
  );
  const [startDate, setStartDate] = useState(initialEvent?.startsOn ?? "");
  const [endDate, setEndDate] = useState(initialEvent?.endsOn ?? "");
  const [startTime, setStartTime] = useState(initialTime.startTime);
  const [endTime, setEndTime] = useState(initialTime.endTime);
  const [timezone, setTimezone] = useState(
    initialTime.timezone || browserTimezone(),
  );
  const [gift, setGift] = useState(initialEvent?.giftsAwards ?? "");
  const [partners, setPartners] = useState<EventPartner[]>(
    initialEvent?.partners ?? [],
  );
  const [organizers, setOrganizers] = useState<string[]>(
    initialEvent?.organizers ?? [],
  );
  const [members, setMembers] = useState<string[]>(
    initialEvent?.members ?? [],
  );

  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState(initialEvent?.coverUrl ?? "");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [partnerName, setPartnerName] = useState("");
  const [partnerLink, setPartnerLink] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<{ id: string; fullName: string }[]>(
    [],
  );
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>(
    [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTeachers()
      .then((rows) =>
        setTeachers(
          rows
            .map((t) => ({ id: t.id, fullName: t.fullName }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        ),
      )
      .catch(() => setTeachers([]));
    listStudents()
      .then((rows) =>
        setStudents(
          rows
            .map((s) => ({ id: s.id, fullName: s.fullName }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        ),
      )
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    if (!coverPreview) return;
    return () => URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ id: t.id, label: t.fullName })),
    [teachers],
  );
  const studentOptions = useMemo(
    () => students.map((s) => ({ id: s.id, label: s.fullName })),
    [students],
  );

  const timezoneOptions = useMemo(() => {
    const local = browserTimezone();
    return TIMEZONE_OPTIONS.includes(local)
      ? TIMEZONE_OPTIONS
      : [local, ...TIMEZONE_OPTIONS];
  }, []);

  const activeType =
    EVENT_TYPE_OPTIONS.find(
      (option) => option.value === type.trim().toLowerCase(),
    ) ?? null;
  const activeGift =
    GIFT_OPTIONS.find(
      (option) => option.value === gift.trim().toLowerCase(),
    ) ?? null;

  const previewImage = coverPreview ?? coverUrl;
  const previewType = activeType?.label ?? type ?? "Event";
  const previewDate = [
    startDate ? formatDay(startDate) : "Date to be announced",
    startTime ? formatTime(composeEventTime(startTime, endTime, "")) : "",
    timezone,
  ]
    .filter(Boolean)
    .join(" · ");

  const pickCover = () => fileInputRef.current?.click();

  const handlePickCover = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the cover.");
      return;
    }
    setError(null);
    try {
      const blob = await fileToCoverJpeg(file);
      setCoverBlob(blob);
      setCoverPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeCover = () => {
    setCoverBlob(null);
    setCoverPreview(null);
    setCoverUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addPartner = () => {
    const name = partnerName.trim();
    const link = partnerLink.trim();
    if (!name && !link) {
      setPartnerError("Add a partner name or a partner link.");
      return;
    }
    setPartnerError(null);
    setPartners((prev) => {
      const duplicate = prev.some(
        (partner) =>
          partner.name.toLowerCase() === name.toLowerCase() &&
          partner.link.toLowerCase() === link.toLowerCase(),
      );
      return duplicate ? prev : [...prev, { name, link }];
    });
    setPartnerName("");
    setPartnerLink("");
  };

  const removePartner = (index: number) => {
    setPartners((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please give the event a title.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    if (startTime && endTime && endTime < startTime) {
      setError("The end time cannot be before the start time.");
      return;
    }

    setSaving(true);
    try {
      const uploadedCover = coverBlob
        ? await uploadEventCover(coverBlob)
        : coverUrl;

      const saved = await saveEvent(
        {
          title: title.trim(),
          type: type || "event",
          description,
          startsOn: startDate,
          endsOn: endDate,
          eventTime: composeEventTime(startTime, endTime, timezone),
          partners,
          giftsAwards: gift,
          organizers,
          members,
          coverUrl: uploadedCover,
        },
        initialEvent?.id,
      );
      onSaved?.(saved, Boolean(initialEvent));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dark min-h-full w-full space-y-6 text-white">
      {/* ------------------------------------------------------ header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Events
            </button>
          )}
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-400">
            Event creator
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {initialEvent ? "Edit Event" : "Create Event"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Set the essentials now — you can refine the details later.
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------ form container */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl sm:p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* ------------------------------------------------ left column */}
            <div className="space-y-5">
              {/* title */}
              <label className="block cursor-text rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors focus-within:border-emerald-500">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Event name
                </span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Regional Cybersecurity Hackathon"
                  className="mt-1 w-full bg-transparent text-lg font-medium text-white outline-none placeholder:text-zinc-600"
                />
              </label>

              {/* start */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Starts
                </p>
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Date
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Clock className="h-3.5 w-3.5" />
                      Time
                    </span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Globe className="h-3.5 w-3.5" />
                      Timezone
                    </span>
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="mt-1.5 w-full truncate rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    >
                      {timezoneOptions.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* end */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Ends
                </p>
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Date
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Clock className="h-3.5 w-3.5" />
                      Time
                    </span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      <Globe className="h-3.5 w-3.5" />
                      Timezone
                    </span>
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="mt-1.5 w-full truncate rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-emerald-500/60"
                    >
                      {timezoneOptions.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* type pills */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Event type
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTIONS.map((option) => {
                    const selected = activeType?.value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setType(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          selected
                            ? "border-emerald-500/50 bg-emerald-500/10 font-medium text-emerald-400 shadow-sm"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {type.trim() && !activeType && (
                  <p className="text-xs text-zinc-500">
                    Keeping the existing type: {type}
                  </p>
                )}
              </div>

              {/* gift pills */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Gift category
                </p>
                <div className="flex flex-wrap gap-2">
                  {GIFT_OPTIONS.map((option) => {
                    const selected = activeGift?.value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setGift(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          selected
                            ? "border-emerald-500/50 bg-emerald-500/10 font-medium text-emerald-400 shadow-sm"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {gift.trim() && !activeGift && (
                  <p className="text-xs text-zinc-500">
                    Keeping the existing value: {gift}
                  </p>
                )}
              </div>

              {/* details */}
              <label className="block cursor-text rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors focus-within:border-emerald-500">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Details
                </span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this event about? Agenda, speakers, what to bring…"
                  className="mt-1 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </label>

              {/* advanced */}
              <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-400 transition-colors hover:text-white">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Partners, organizers &amp; members
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-zinc-800 p-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Partners
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={partnerName}
                        onChange={(event) => {
                          setPartnerName(event.target.value);
                          setPartnerError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addPartner();
                          }
                        }}
                        placeholder="Partner name"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/60"
                      />
                      <input
                        value={partnerLink}
                        onChange={(event) => {
                          setPartnerLink(event.target.value);
                          setPartnerError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addPartner();
                          }
                        }}
                        placeholder="https://…"
                        className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/60"
                      />
                      <button
                        type="button"
                        onClick={addPartner}
                        disabled={!partnerName.trim() && !partnerLink.trim()}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    {partnerError && (
                      <p className="text-xs text-red-400">{partnerError}</p>
                    )}
                    {partners.length > 0 && (
                      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
                        {partners.map((partner, index) => (
                          <li
                            key={`${partner.name}-${partner.link}-${index}`}
                            className="flex items-center gap-3 bg-zinc-950/40 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-zinc-200">
                              {partner.name || partner.link}
                            </span>
                            <span className="hidden min-w-0 flex-1 truncate text-xs text-zinc-500 sm:block">
                              {partner.link || "No link"}
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove ${
                                partner.name || partner.link
                              }`}
                              onClick={() => removePartner(index)}
                              className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <PeopleMultiSelect
                      label="Organizers"
                      options={teacherOptions}
                      selected={organizers}
                      onChange={setOrganizers}
                      placeholder="Search teachers…"
                      emptyText="No teacher matches that search."
                      noOptionsText="No teachers available."
                      popoverClassName="dark"
                    />
                    <PeopleMultiSelect
                      label="Members"
                      options={studentOptions}
                      selected={members}
                      onChange={setMembers}
                      placeholder="Search students…"
                      emptyText="No student matches that search."
                      noOptionsText="No students available."
                      popoverClassName="dark"
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* ----------------------------------------------- right column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Cover banner
                </p>
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void handlePickCover(event.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                    previewImage
                      ? "border-zinc-800 bg-zinc-900"
                      : "cursor-pointer border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/50 hover:bg-zinc-900",
                    dragging && "border-emerald-500/60 bg-zinc-900",
                  )}
                  onClick={previewImage ? undefined : pickCover}
                >
                  {previewImage ? (
                    <>
                      <img
                        src={previewImage}
                        alt="Event cover preview"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={pickCover}
                          className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
                        >
                          Change image
                        </button>
                        <button
                          type="button"
                          aria-label="Remove cover"
                          onClick={removeCover}
                          className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition-colors hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          Upload cover image
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Drag &amp; drop or click to browse. JPG or PNG.
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-500">
                        Recommended 1200 × 1200
                      </span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handlePickCover(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>

              {/* live preview */}
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-zinc-950">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3">
                    <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                      {previewType}
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-white">
                      {title.trim() || "Your event title"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {previewDate}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                The cover and details appear on the teacher portal as soon as
                you save.
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------ footer */}
          <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Only the event name is required.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? "Saving…"
                  : initialEvent
                    ? "Save changes"
                    : "Create event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

