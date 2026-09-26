import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PeopleMultiSelect from "@/components/PeopleMultiSelect";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  errorMessage,
  EVENT_TYPES,
  listStudents,
  listTeachers,
  saveEvent,
  uploadEventCover,
  type AppEvent,
} from "@/lib/api";
import { asLink } from "./eventFormat";

const COVER_MAX_WIDTH = 800;

type EventDraft = Omit<AppEvent, "id" | "createdAt">;

const EMPTY_DRAFT: EventDraft = {
  title: "",
  type: "Event",
  description: "",
  startsOn: "",
  endsOn: "",
  eventTime: "",
  partners: [],
  giftsAwards: "",
  organizers: [],
  members: [],
  coverUrl: "",
};

interface EventsPageProps {
  /**
   * When set, the form opens pre-filled to update that event. The layout clears
   * it once the save succeeds, so returning to this page starts a fresh event.
   */
  initialEvent?: AppEvent | null;
  /**
   * Called after a successful save with the stored row and whether it was an
   * update. The layout uses it to clear the edit target and move the admin to
   * Event History, where the new row is listed.
   */
  onSaved?: (saved: AppEvent, wasUpdate: boolean) => void;
  /**
   * Abandons an edit and returns to a blank form. Deliberately separate from
   * onSaved: cancelling must not jump to Event History, since nothing changed.
   */
  onCancelEdit?: () => void;
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

/**
 * The event creation / editing form. Listing, deleting and reviewing past
 * events is a separate page (EventHistoryPage) reached from the sidebar, so
 * this page does one thing.
 */
export default function EventsPage({
  initialEvent,
  onSaved,
  onCancelEdit,
}: EventsPageProps) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initialEvent
      ? {
          title: initialEvent.title,
          type: initialEvent.type,
          description: initialEvent.description,
          startsOn: initialEvent.startsOn,
          endsOn: initialEvent.endsOn,
          eventTime: initialEvent.eventTime,
          partners: initialEvent.partners,
          giftsAwards: initialEvent.giftsAwards,
          organizers: initialEvent.organizers,
          members: initialEvent.members,
          coverUrl: initialEvent.coverUrl,
        }
      : EMPTY_DRAFT,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Staged partner, committed to draft.partners by "Add Partner" or Enter.
  const [partnerName, setPartnerName] = useState("");
  const [partnerLink, setPartnerLink] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // A picked cover is kept as a downscaled Blob and previewed locally; it is
  // uploaded to Storage only on save, so abandoning the form leaves no orphan
  // object behind.
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [teachers, setTeachers] = useState<{ id: string; fullName: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);

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

  // Arriving here to edit an event should bring the form into view.
  useEffect(() => {
    if (!initialEvent) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialEvent]);

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ id: t.id, label: t.fullName })),
    [teachers],
  );
  const studentOptions = useMemo(
    () => students.map((s) => ({ id: s.id, label: s.fullName })),
    [students],
  );

  /**
   * Appends the staged partner as a {name, link} pair. At least one field is
   * required; an exact repeat of an existing pair is ignored so a double-click
   * on "Add Partner" cannot add the same partner twice.
   */
  const addPartner = () => {
    const name = partnerName.trim();
    const link = partnerLink.trim();
    if (!name && !link) {
      setPartnerError("Add a partner name or a partner link.");
      return;
    }
    setPartnerError(null);
    setDraft((prev) => {
      const duplicate = prev.partners.some(
        (partner) =>
          partner.name.toLowerCase() === name.toLowerCase() &&
          partner.link.toLowerCase() === link.toLowerCase(),
      );
      return duplicate
        ? prev
        : { ...prev, partners: [...prev.partners, { name, link }] };
    });
    setPartnerName("");
    setPartnerLink("");
  };

  const removePartner = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      partners: prev.partners.filter((_, i) => i !== index),
    }));
  };

  const handlePickCover = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await fileToCoverJpeg(file);
      setCoverBlob(blob);
      setCoverPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!draft.title.trim()) {
      setError("Please give the event a title.");
      return;
    }
    if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setSaving(true);
    try {
      // Upload the freshly picked cover only now, so an abandoned form does
      // not leave an object in the bucket.
      const coverUrl = coverBlob
        ? await uploadEventCover(coverBlob)
        : draft.coverUrl;

      const saved = await saveEvent(
        { ...draft, title: draft.title.trim(), coverUrl },
        initialEvent?.id,
      );

      // Reset first, then hand off: the layout switches to Event History, so
      // this form unmounts and the confirmation is shown there instead.
      setDraft(EMPTY_DRAFT);
      setPartnerName("");
      setPartnerLink("");
      setPartnerError(null);
      setCoverBlob(null);
      setCoverPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSaved?.(saved, Boolean(initialEvent));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">
        {initialEvent ? "Edit event" : "New event or publication"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only the title is required. Everything else can be filled in later, and
        saved events are listed under{" "}
        <span className="font-medium">Events → Event History</span>. Saving
        takes you there automatically.
      </p>

      <Card className="mt-4 w-full">
        <CardHeader>
          <CardTitle>
            {initialEvent ? `Editing "${initialEvent.title}"` : "Event details"}
          </CardTitle>
          <CardDescription>
            Covers are stored in the <code>event-covers</code> bucket and
            downscaled to {COVER_MAX_WIDTH}px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* ------------------------------------------------------ cover */}
            <div className="space-y-2">
              <Label htmlFor="event-cover">Cover image</Label>
              {coverPreview || draft.coverUrl ? (
                <div className="relative w-full max-w-xs overflow-hidden rounded-lg border bg-muted/30">
                  <img
                    src={coverPreview ?? draft.coverUrl}
                    alt="Event cover preview"
                    className="aspect-[3/4] w-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => {
                      setCoverBlob(null);
                      setCoverPreview(null);
                      setDraft((prev) => ({ ...prev, coverUrl: "" }));
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-[3/4] w-full max-w-xs flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/40"
                >
                  <ImagePlus className="h-6 w-6" />
                  Choose a cover image
                </button>
              )}
              <input
                ref={fileInputRef}
                id="event-cover"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePickCover(e.target.files?.[0])}
              />
            </div>

            {/* ------------------------------------------------------ title */}
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                placeholder="e.g. Regional Cybersecurity Hackathon"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>

            {/* ------------------------------------------------------- type */}
            <div className="space-y-2">
              <Label htmlFor="event-type">Type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  setDraft({ ...draft, type: value ?? "Event" })
                }
              >
                <SelectTrigger id="event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ----------------------------------------------- description */}
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                rows={5}
                placeholder="What is this event about?"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>

            {/* ------------------------------------------- dates and time */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start date</Label>
                <Input
                  id="event-start"
                  type="date"
                  value={draft.startsOn}
                  onChange={(e) =>
                    setDraft({ ...draft, startsOn: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End date</Label>
                <Input
                  id="event-end"
                  type="date"
                  value={draft.endsOn}
                  onChange={(e) =>
                    setDraft({ ...draft, endsOn: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={draft.eventTime}
                  onChange={(e) =>
                    setDraft({ ...draft, eventTime: e.target.value })
                  }
                />
              </div>
            </div>

            {/* -------------------------------------------------- partners */}
            <div className="space-y-2">
              <Label htmlFor="event-partner-name">Partners</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="event-partner-name"
                  className="sm:max-w-[14rem]"
                  placeholder="Partner Name, e.g., GDG"
                  value={partnerName}
                  onChange={(e) => {
                    setPartnerName(e.target.value);
                    setPartnerError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPartner();
                    }
                  }}
                />
                <Input
                  id="event-partner-link"
                  placeholder="Paste the partner's link here, e.g., https://..."
                  value={partnerLink}
                  onChange={(e) => {
                    setPartnerLink(e.target.value);
                    setPartnerError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPartner();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPartner}
                  disabled={!partnerName.trim() && !partnerLink.trim()}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Partner
                </Button>
              </div>

              {partnerError && (
                <p className="text-xs text-destructive">{partnerError}</p>
              )}

              {draft.partners.length > 0 ? (
                <ul className="divide-y overflow-hidden rounded-md border">
                  {draft.partners.map((partner, index) => {
                    const href = asLink(partner.link);
                    const label = partner.name || partner.link;
                    return (
                      <li
                        key={`${partner.name}-${partner.link}-${index}`}
                        className="flex items-center gap-3 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {label}
                        </span>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 max-w-[18rem] flex-1 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            {partner.link}
                          </a>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            No link
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove partner ${label}`}
                          title="Remove partner"
                          onClick={() => removePartner(index)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No partners added yet. Enter a name and/or a link, then press
                  Add Partner or Enter.
                </p>
              )}
            </div>

            {/* -------------------------------------------- gifts & awards */}
            <div className="space-y-2">
              <Label htmlFor="event-awards">Gifts &amp; awards</Label>
              <Textarea
                id="event-awards"
                rows={3}
                placeholder="Prizes, rewards or certifications offered"
                value={draft.giftsAwards}
                onChange={(e) =>
                  setDraft({ ...draft, giftsAwards: e.target.value })
                }
              />
            </div>

            {/* --------------------------------- organizers and members */}
            <div className="grid gap-4 sm:grid-cols-2">
              <PeopleMultiSelect
                label="Organizers"
                options={teacherOptions}
                selected={draft.organizers}
                onChange={(organizers) => setDraft({ ...draft, organizers })}
                placeholder="Search teachers…"
                emptyText="No teacher matches that search."
                noOptionsText="No teachers available."
              />
              <PeopleMultiSelect
                label="Members"
                options={studentOptions}
                selected={draft.members}
                onChange={(members) => setDraft({ ...draft, members })}
                placeholder="Search students…"
                emptyText="No student matches that search."
                noOptionsText="No students available."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : initialEvent ? "Update event" : "Create event"}
              </Button>
              {initialEvent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancelEdit?.()}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
