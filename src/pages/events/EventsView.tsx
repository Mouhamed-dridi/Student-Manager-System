import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
  Users,
  X,
} from "lucide-react";
import {
  errorMessage,
  saveEvent,
  uploadEventCover,
  type AppEvent,
  type EventPartner,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  GIFT_OPTIONS,
  composeEventTime,
  formatDay,
  formatTime,
  parseEventTime,
  splitGifts,
} from "./eventFormat";

/** The four kinds of event the creator offers. Stored as free text. */
const EVENT_TYPE_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "workshop", label: "Workshop" },
  { value: "hackathon", label: "Hackathon" },
  { value: "talks", label: "Talks" },
] as const;

const COVER_MAX_WIDTH = 800;

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
  const t = useT();
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
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [gifts, setGifts] = useState<string[]>(() =>
    splitGifts(initialEvent?.giftsAwards ?? ""),
  );
  const [partners, setPartners] = useState<EventPartner[]>(
    initialEvent?.partners ?? [],
  );
  // Organizers/members are not edited by this form; the stored ids pass
  // through unchanged so saving an edit never silently clears them.
  const organizers = initialEvent?.organizers ?? [];
  const members = initialEvent?.members ?? [];

  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState(initialEvent?.coverUrl ?? "");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [partnerName, setPartnerName] = useState("");
  const [partnerLink, setPartnerLink] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverPreview) return;
    return () => URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const activeType =
    EVENT_TYPE_OPTIONS.find(
      (option) => option.value === type.trim().toLowerCase(),
    ) ?? null;
  // Stored values that are not one of the pills (legacy rows) are kept in the
  // list so saving does not drop them; they are surfaced below the pills.
  const unknownGifts = gifts.filter(
    (gift) =>
      !GIFT_OPTIONS.some((option) => option.value === gift.toLowerCase()),
  );

  const previewImage = coverPreview ?? coverUrl;
  const previewType = activeType ? t(activeType.label) : type || t("Event");
  const previewDate = [
    startDate ? formatDay(startDate) : t("Date to be announced"),
    startTime ? formatTime(composeEventTime(startTime, endTime, "")) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const pickCover = () => fileInputRef.current?.click();

  const handlePickCover = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("Choose an image file for the cover."));
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
      setPartnerError(t("Add a partner name or a partner link."));
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

  const toggleGift = (value: string) => {
    setGifts((prev) =>
      prev.some((gift) => gift.toLowerCase() === value)
        ? prev.filter((gift) => gift.toLowerCase() !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("Please give the event a title."));
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError(t("The end date cannot be before the start date."));
      return;
    }
    if (startTime && endTime && endTime < startTime) {
      setError(t("The end time cannot be before the start time."));
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
          eventTime: composeEventTime(startTime, endTime, ""),
          location: location.trim(),
          partners,
          giftsAwards: gifts.join(", "),
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
    <div className="min-h-full w-full space-y-6 text-zinc-900 dark:text-white">
      {/* ------------------------------------------------------ header */}
      {/* The only title on the page: navigation lives in the portal top bar
          (this view registers with useNestedView), so there is no second
          "Back to Events" link competing with it. */}
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {initialEvent ? t("Edit Event") : t("Create New Event")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("Set the essentials now — you can refine the details later.")}
        </p>
      </header>

      {/* ------------------------------------------------------ form container */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* ------------------------------------------------ left column */}
            <div className="space-y-5">
              {/* title */}
              <label className="block cursor-text rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-400">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Event name")}
                </span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("e.g. Regional Cybersecurity Hackathon")}
                  className="mt-1 w-full bg-transparent text-lg font-medium text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </label>

              {/* start */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Starts")}
                </p>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("Date")}
                    </span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark] focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {t("Time")}
                    </span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark] focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
                    />
                  </div>
                </div>
              </div>

              {/* end */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Ends")}
                </p>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("Date")}
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark] focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {t("Time")}
                    </span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark] focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
                    />
                  </div>
                </div>
              </div>

              {/* location */}
              <label className="block cursor-text rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-400">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("Location / Google Maps link")}
                </span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={t("https://maps.app.goo.gl/… or Room B-12")}
                  className="mt-1 w-full bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </label>

              {/* type pills */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Event type")}
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
                          "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:focus-visible:ring-zinc-500",
                          selected
                            ? "border-zinc-900 bg-zinc-900 font-semibold text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white",
                        )}
                      >
                        {t(option.label)}
                      </button>
                    );
                  })}
                </div>
                {type.trim() && !activeType && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("Keeping the existing type: {type}", { type })}
                  </p>
                )}
              </div>

              {/* gift pills */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Gift categories")}
                  <span className="ml-2 normal-case tracking-normal text-zinc-400 dark:text-zinc-600">
                    {t("Select all that apply")}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {GIFT_OPTIONS.map((option) => {
                    const selected = gifts.some(
                      (gift) => gift.toLowerCase() === option.value,
                    );
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleGift(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:focus-visible:ring-zinc-500",
                          selected
                            ? "border-zinc-900 bg-zinc-900 font-semibold text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white",
                        )}
                      >
                        {t(option.label)}
                      </button>
                    );
                  })}
                </div>
                {unknownGifts.length > 0 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("Also keeping: {list}", {
                      list: unknownGifts.join(", "),
                    })}
                  </p>
                )}
              </div>

              {/* details */}
              <label className="block cursor-text rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-400">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Details")}
                </span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t(
                    "What is this event about? Agenda, speakers, what to bring…",
                  )}
                  className="mt-1 w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </label>

              {/* advanced */}
              <details className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-white">
                  <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t("Partners")}
                    </span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t("Partners")}
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
                        placeholder={t("Partner name")}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2.5 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
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
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-2.5 py-2 text-sm text-zinc-900 dark:text-white outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-0 dark:focus:border-zinc-400"
                      />
                      <button
                        type="button"
                        onClick={addPartner}
                        disabled={!partnerName.trim() && !partnerLink.trim()}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                        {t("Add")}
                      </button>
                    </div>
                    {partnerError && (
                      <p className="text-xs text-red-600 dark:text-red-400">{partnerError}</p>
                    )}
                    {partners.length > 0 && (
                      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                        {partners.map((partner, index) => (
                          <li
                            key={`${partner.name}-${partner.link}-${index}`}
                            className="flex items-center gap-3 bg-zinc-50 px-3 py-2 dark:bg-zinc-900 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                              {partner.name || partner.link}
                            </span>
                            <span className="hidden min-w-0 flex-1 truncate text-xs text-zinc-500 sm:block">
                              {partner.link || t("No link")}
                            </span>
                            <button
                              type="button"
                              aria-label={t("Remove {name}", {
                                name: partner.name || partner.link,
                              })}
                              onClick={() => removePartner(index)}
                              className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                </div>
              </details>
            </div>

            {/* ----------------------------------------------- right column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("Cover banner")}
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
                    "relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-all",
                    previewImage
                      ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      : "cursor-pointer border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
                    dragging &&
                      "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900",
                  )}
                  onClick={previewImage ? undefined : pickCover}
                >
                  {previewImage ? (
                    <>
                      <img
                        src={previewImage}
                        alt={t("Event cover preview")}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={pickCover}
                          className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
                        >
                          {t("Change image")}
                        </button>
                        <button
                          type="button"
                          aria-label={t("Remove cover")}
                          onClick={removeCover}
                          className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition-colors hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {t("Upload cover image")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t("Drag & drop or click to browse. JPG or PNG.")}
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        {t("Recommended 1200 × 1200")}
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
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-zinc-700/40 via-zinc-900 to-zinc-950">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3">
                    <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-100">
                      {previewType}
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-white">
                      {title.trim() || t("Your event title")}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-300">
                      {previewDate}
                    </p>
                    {location.trim() && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                        {location.trim()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                {t(
                  "The cover and details appear on the teacher portal as soon as you save.",
                )}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------ footer */}
          <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("Only the event name is required.")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                >
                  {t("Cancel")}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-500"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? t("Saving…")
                  : initialEvent
                    ? t("Save changes")
                    : t("Create event")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

