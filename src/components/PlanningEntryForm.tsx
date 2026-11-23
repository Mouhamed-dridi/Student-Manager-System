import { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Loader2,
  Paperclip,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLANNING_CLASSROOM,
  defaultPlanningSessionType,
  formatSessionTime,
  isPlanningSessionType,
  ONLINE_SESSION_LOCATION,
  parseSessionTime,
  planningCategoryFor,
  planningEntryTypesForCategory,
  planningSessionTypeKey,
  planningSlotKey,
  PLANNING_CLASSROOMS,
  PLANNING_SESSION_TYPES,
} from "@/pages/teacher-portal/planning";
import type {
  PlanningCategory,
  PlanningClassOption,
  PlanningEntryValues,
  PlanningRecord,
  PlanningSessionType,
} from "@/pages/teacher-portal/planning";

// Shared by the teacher Planning page, the operator Planification editor and
// the operator branch timetable, so the writes cannot drift apart. The teacher
// portal renders it without `teacherOptions` (an entry always belongs to the
// signed-in teacher); the operator passes them to choose the teacher.
//
// The branch timetable (`BranchPlanningPage`) opts into the class-based
// behaviour: `lockClass`, a fixed `subjects` list, `teacherQualifier` so the
// teacher picker follows the subject, `timeSlots` for a preset window select
// and `showNotes` for the internal comment. It also asks for `layout="grid"`,
// the landscape form (date | class | subject / teacher | type | room / time |
// topic / notes) — the teacher dialogs stay narrow, so they keep the stack.

const NO_CLASS = "__none";
const CUSTOM_TIME = "__custom";

/** The live form state, reported so a caller can check for timetable clashes. */
export interface PlanningEntryDraft {
  teacherId?: string;
  className?: string;
  roomName?: string;
  sessionType?: PlanningSessionType;
  sessionTime?: string;
}

/**
 * `stack` is the original single column used by the teacher dialogs; `grid` is
 * the landscape form for the operator's wide session dialog.
 */
export type PlanningEntryLayout = "stack" | "grid";

export interface PlanningEntryFormProps {
  initial?: PlanningRecord;
  courses: string[];
  classes: PlanningClassOption[];
  submitLabel: string;
  showCancel: boolean;
  onSubmit: (values: PlanningEntryValues) => void;
  onCancel: () => void;
  /** Operator only: lets a session be reassigned to another teacher. */
  teacherOptions?: { id: string; label: string }[];
  /** Teacher pre-selected for a new entry (operator only). */
  defaultTeacherId?: string;
  /** Timetable slot to prefill when adding a session (operator branch view). */
  defaultSessionTime?: string;
  /** Timetables do not always have a topic; the teacher page still requires one. */
  requireContent?: boolean;
  /** Reports the draft on every change (operator timetable conflict checks). */
  onDraftChange?: (draft: PlanningEntryDraft) => void;
  /**
   * Fixed subject list. When set, it replaces the course catalog for the
   * `course` field (the subject is what a branch timetable schedules).
   */
  subjects?: readonly string[];
  /**
   * Teacher ids qualified for the chosen subject. Only ever narrows the
   * teacher picker: an empty result shows every teacher instead.
   */
  teacherQualifier?: (subject: string) => string[];
  /** The class is fixed by the branch, so it is shown read-only. */
  lockClass?: boolean;
  /** Preset windows for the time select; "Custom times" keeps free entry. */
  timeSlots?: readonly string[];
  /** Operator-only internal note (`planning.notes`). */
  showNotes?: boolean;
  /**
   * The session's day, edited inside the form. Only the branch timetable
   * passes it (changing it there is how a session is moved).
   */
  date?: string;
  onDateChange?: (date: string) => void;
  /** Landscape grid when the dialog is wide enough, single column otherwise. */
  layout?: PlanningEntryLayout;
  /**
   * Teacher entry dialog: adds the Course & Materials / Exam / PFE switcher,
   * narrows the session types per category, relabels the notes field and offers
   * the daily lesson material attachment. Operator forms keep the full list.
   */
  showCategory?: boolean;
  /**
   * Uploads a daily lesson material and resolves to its public URL and display
   * name. Only the teacher page passes it, because the upload is namespaced by
   * the signed-in teacher's id.
   */
  onUploadMaterial?: (
    file: File,
  ) => Promise<{ url: string; name: string }>;
}

const CATEGORY_OPTIONS: {
  value: PlanningCategory;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { value: "course", label: "Course & Materials", icon: BookOpen },
  { value: "exam", label: "Exam Planning", icon: ClipboardList },
  { value: "pfe", label: "PFE Planning", icon: GraduationCap },
];

export default function PlanningEntryForm({
  initial,
  courses,
  classes,
  submitLabel,
  showCancel,
  onSubmit,
  onCancel,
  teacherOptions,
  defaultTeacherId,
  defaultSessionTime,
  requireContent = true,
  onDraftChange,
  subjects,
  teacherQualifier,
  lockClass = false,
  timeSlots,
  showNotes = false,
  date,
  onDateChange,
  layout = "stack",
  showCategory = false,
  onUploadMaterial,
}: PlanningEntryFormProps) {
  const { t } = useI18n();
  // A category is a view over the stored session type, so an old row opens on
  // the right tab without a second column.
  const [category, setCategory] = useState<PlanningCategory>(() =>
    planningCategoryFor(initial?.sessionType),
  );
  const [materialUrl, setMaterialUrl] = useState(initial?.materialUrl ?? "");
  const [materialName, setMaterialName] = useState(initial?.materialName ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState(
    initial?.teacherId ?? defaultTeacherId ?? "",
  );
  const [course, setCourse] = useState(initial?.course ?? "");
  const [sessionType, setSessionType] = useState<PlanningSessionType>(
    initial?.sessionType ?? "In-class",
  );
  // A teacher with a single assigned class gets it prefilled; otherwise the
  // field stays blank until they pick one.
  const [className, setClassName] = useState(
    initial?.className ?? (classes.length === 1 ? classes[0].label : ""),
  );
  const initialTime = parseSessionTime(
    initial?.sessionTime ?? defaultSessionTime,
  );
  const [startTime, setStartTime] = useState(initialTime.start);
  const [endTime, setEndTime] = useState(initialTime.end);
  const [slotValue, setSlotValue] = useState(() => {
    if (!timeSlots || timeSlots.length === 0) return CUSTOM_TIME;
    const current = formatSessionTime(initialTime.start, initialTime.end);
    return (
      timeSlots.find((slot) => planningSlotKey(slot) === planningSlotKey(current)) ??
      CUSTOM_TIME
    );
  });
  // An Online session has no classroom: its location is the meeting platform,
  // so a legacy room stored on the row is replaced when the form opens.
  const [roomName, setRoomName] = useState(
    initial?.sessionType === "Online"
      ? ONLINE_SESSION_LOCATION
      : initial?.roomName?.trim() || DEFAULT_PLANNING_CLASSROOM,
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // A room stored before the list was fixed (or typed by hand) stays
  // selectable, so editing an old entry never silently moves it.
  const roomOptions: string[] =
    roomName && !(PLANNING_CLASSROOMS as readonly string[]).includes(roomName)
      ? [roomName, ...PLANNING_CLASSROOMS]
      : [...PLANNING_CLASSROOMS];

  // Same idea for the subject: a legacy free-text course stays selectable so
  // opening and saving a session cannot blank it.
  const subjectOptions: string[] = [...(subjects ?? courses)];
  if (course && !subjectOptions.includes(course)) subjectOptions.unshift(course);

  // Subject → teacher: keep the current pick even when it is not linked to the
  // new subject, and never narrow to nothing (the admin may know better).
  const qualifiedIds =
    teacherQualifier && course ? teacherQualifier(course) : [];
  const effectiveTeacherOptions = teacherOptions
    ? qualifiedIds.length > 0
      ? teacherOptions.filter(
          (option) =>
            qualifiedIds.includes(option.id) || option.id === teacherId,
        )
      : teacherOptions
    : undefined;
  const linkedTeacherCount = effectiveTeacherOptions
    ? effectiveTeacherOptions.filter((option) => qualifiedIds.includes(option.id))
        .length
    : 0;

  const categoryTypes = showCategory
    ? planningEntryTypesForCategory(category)
    : PLANNING_SESSION_TYPES;
  const contentLabel = !showCategory
    ? t("Topic / course details")
    : t(
        category === "exam"
          ? "Exam notes"
          : category === "pfe"
            ? "Jury / supervision notes"
            : "Topic / course details",
      );
  const contentPlaceholder = !showCategory
    ? t("e.g. Chapter 3: IP Routing Protocols, or Lab 2: React Hooks")
    : t(
        category === "exam"
          ? "e.g. DS on Chapter 4 — closed book, calculators allowed"
          : category === "pfe"
            ? "e.g. Mid-project review with the supervisor and the jury"
            : "e.g. Chapter 3: IP Routing Protocols, or Lab 2: React Hooks",
      );

  const changeCategory = (next: PlanningCategory) => {
    setCategory(next);
    // Keep a stored type that already belongs to the chosen category (editing a
    // DS stays a DS), otherwise start from that category's first kind.
    if (planningCategoryFor(sessionType) !== next) {
      const nextType = defaultPlanningSessionType(next);
      setSessionType(nextType);
      // Online is the only type with a platform location; switching away from
      // it restores a real classroom so the room select is never locked empty.
      if (nextType === "Online") {
        setRoomName(ONLINE_SESSION_LOCATION);
      } else if (roomName === ONLINE_SESSION_LOCATION) {
        setRoomName(DEFAULT_PLANNING_CLASSROOM);
      }
    }
  };

  const handleMaterialUpload = async (file: File | null) => {
    if (!file || !onUploadMaterial) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await onUploadMaterial(file);
      setMaterialUrl(uploaded.url);
      setMaterialName(uploaded.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const timeInvalid = Boolean(startTime && endTime && endTime < startTime);
  const teacherMissing = Boolean(teacherOptions && !teacherId);
  const contentMissing = requireContent && content.trim() === "";
  const valid =
    !contentMissing && !timeInvalid && !teacherMissing && !uploading;

  const isGrid = layout === "grid";
  // In the grid, every cell is a column of its own; `space-y-1.5` keeps the
  // label, control and hint tight enough for three rows to fit a landscape
  // dialog without scrolling.
  const fieldClass = isGrid ? "min-w-0 space-y-1.5" : "min-w-0 space-y-2";
  // Long option labels must truncate inside the trigger instead of widening
  // the card past its right border.
  const controlClass =
    "w-full min-w-0 max-w-full box-border [&_[data-slot=select-value]]:min-w-0";

  // Optional: the operator branch timetable watches the draft to warn about
  // an overlapping teacher, room or class before the session is saved.
  useEffect(() => {
    onDraftChange?.({
      teacherId: teacherId || undefined,
      className: className || undefined,
      roomName: roomName || undefined,
      sessionType,
      sessionTime: formatSessionTime(startTime, endTime),
    });
  }, [
    teacherId,
    className,
    roomName,
    sessionType,
    startTime,
    endTime,
    onDraftChange,
  ]);

  return (
    <div className={isGrid ? "space-y-3" : "min-w-0 space-y-4"}>
      {showCategory ? (
        <div
          role="group"
          aria-label={t("Planning category")}
          className="grid w-full min-w-0 grid-cols-3 gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-[3px] dark:border-zinc-800 dark:bg-zinc-900"
        >
          {CATEGORY_OPTIONS.map((option) => {
            const active = option.value === category;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => changeCategory(option.value)}
                className={cn(
                  "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] leading-tight font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 text-center">
                  {t(option.label)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={
          isGrid
            ? "grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-3"
            : "min-w-0 space-y-4"
        }
      >
        {onDateChange ? (
          <div className={fieldClass}>
            <Label htmlFor="log-date">{t("Date")}</Label>
            <Input
              id="log-date"
              type="date"
              className={controlClass}
              value={date ?? ""}
              onChange={(event) => onDateChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("Changing the date moves the session.")}
            </p>
          </div>
        ) : null}

        {lockClass ? (
          <div className={fieldClass}>
            <Label>{t("Class / Branch")}</Label>
            <div className="flex h-8 min-w-0 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
              <span className="truncate">{className || t("No class")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Fixed by the branch this timetable belongs to.")}
            </p>
          </div>
        ) : (
          <div className={fieldClass}>
            <Label>{t("Class")}</Label>
            <Select
              value={className || NO_CLASS}
              onValueChange={(value) =>
                setClassName(value === NO_CLASS ? "" : (value ?? ""))
              }
            >
              <SelectTrigger className={controlClass}>
                <SelectValue
                  placeholder={
                    classes.length > 0
                      ? t("Select class")
                      : t("No class assigned")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLASS}>{t("No class")}</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.label} value={c.label}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={fieldClass}>
          <Label>{t(subjects ? "Subject" : "Course")}</Label>
          <Select value={course} onValueChange={(value) => setCourse(value ?? "")}>
            <SelectTrigger className={controlClass}>
              <SelectValue
                placeholder={
                  subjectOptions.length > 0
                    ? subjects
                      ? t("Select subject")
                      : t("Select course")
                    : t("No courses available")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {effectiveTeacherOptions ? (
          <div className={fieldClass}>
            <Label>{t("Teacher")}</Label>
            <Select
              value={teacherId}
              onValueChange={(value) => setTeacherId(value ?? "")}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder={t("Select teacher")} />
              </SelectTrigger>
              <SelectContent>
                {effectiveTeacherOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {qualifiedIds.length > 0
                ? t(
                    linkedTeacherCount === 1
                      ? "{count} teacher is linked to {course}. Changing this moves the session to that teacher's planning."
                      : "{count} teachers are linked to {course}. Changing this moves the session to that teacher's planning.",
                    { count: linkedTeacherCount, course },
                  )
                : teacherQualifier && course
                  ? t(
                      "No teacher is linked to {course} yet — showing all teachers.",
                      { course },
                    )
                  : t(
                      "Changing this moves the session to that teacher's planning.",
                    )}
            </p>
          </div>
        ) : null}

        <div className={fieldClass}>
          <Label>
            {t(
              showCategory
                ? category === "exam"
                  ? "Exam Type"
                  : category === "pfe"
                    ? "PFE Milestone"
                    : "Session Type"
                : "Session Type",
            )}
          </Label>
          <Select
            value={sessionType}
            items={categoryTypes.map((type) => ({
              value: type,
              label: t(planningSessionTypeKey(type)),
            }))}
            onValueChange={(value) => {
              if (!isPlanningSessionType(value)) return;
              setSessionType(value);
              // Switching to Online stamps the meeting platform as the location
              // and drops the classroom; switching back restores a real room.
              if (value === "Online") {
                setRoomName(ONLINE_SESSION_LOCATION);
              } else if (roomName === ONLINE_SESSION_LOCATION) {
                setRoomName(DEFAULT_PLANNING_CLASSROOM);
              }
            }}
          >
            <SelectTrigger className={controlClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(planningSessionTypeKey(type))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sessionType === "Online" ? (
          <div className={fieldClass}>
            <Label>{t("Session location")}</Label>
            <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 text-sm">
              <Video className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-400" />
              <span className="truncate">{ONLINE_SESSION_LOCATION}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "Online sessions meet on {platform}, so no classroom is assigned.",
                { platform: ONLINE_SESSION_LOCATION },
              )}
            </p>
          </div>
        ) : (
          <div className={fieldClass}>
            <Label>{t("Classroom / Room")}</Label>
            <Select
              value={roomName}
              onValueChange={(value) => setRoomName(value ?? "")}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder={t("Select classroom")} />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((room) => (
                  <SelectItem key={room} value={room}>
                    {room}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(
                "Shown as a badge next to the session time in every planning view.",
              )}
            </p>
          </div>
        )}

        <div className={fieldClass}>
          <Label>{t("Time")}</Label>
          {timeSlots && timeSlots.length > 0 ? (
            <Select
              value={slotValue}
              onValueChange={(value) => {
                const next = value ?? CUSTOM_TIME;
                setSlotValue(next);
                if (next !== CUSTOM_TIME) {
                  const parsed = parseSessionTime(next);
                  setStartTime(parsed.start);
                  setEndTime(parsed.end);
                }
              }}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder={t("Select a time slot")} />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_TIME}>
                  {t("Custom times…")}
                </SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          {!timeSlots || slotValue === CUSTOM_TIME ? (
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2.5">
              <Input
                id="log-start-time"
                type="time"
                className="w-full min-w-0"
                aria-label={t("Session start time")}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">{t("to")}</span>
              <Input
                id="log-end-time"
                type="time"
                className="w-full min-w-0"
                aria-label={t("Session end time")}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          ) : null}
          {timeInvalid ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t("End time must be after the start time.")}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t(
                "Optional. Pick a slot, or use custom times for any other window.",
              )}
            </p>
          )}
        </div>

        <div
          className={
            isGrid ? "min-w-0 space-y-1.5 md:col-span-2 lg:col-span-2" : "min-w-0 space-y-2"
          }
        >
          <Label htmlFor="log-content">{contentLabel}</Label>
          <Textarea
            id="log-content"
            rows={isGrid ? 3 : undefined}
            className="w-full min-w-0 max-w-full box-border"
            placeholder={contentPlaceholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {showCategory && category === "course" ? (
          <div
            className={
              isGrid
                ? "min-w-0 space-y-1.5 md:col-span-2 lg:col-span-3"
                : "min-w-0 space-y-2"
            }
          >
            <Label htmlFor="log-material">{t("Lesson material")}</Label>
            <Input
              id="log-material"
              type="url"
              className="w-full min-w-0 max-w-full box-border"
              placeholder={t(
                "https://… link to the slides, PDF or resource used in class",
              )}
              value={materialUrl}
              onChange={(e) => {
                setMaterialUrl(e.target.value);
                // A pasted link replaces the uploaded file: drop its name so
                // the badge falls back to the URL instead of a wrong filename.
                setMaterialName("");
              }}
            />
            {onUploadMaterial ? (
              <Input
                id="log-material-file"
                type="file"
                disabled={uploading}
                className="w-full min-w-0 max-w-full box-border"
                aria-label={t("Upload a lesson material")}
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  void handleMaterialUpload(picked);
                }}
              />
            ) : null}
            {uploading ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                {t("Uploading…")}
              </p>
            ) : materialUrl ? (
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/80">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {materialName || materialUrl}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t("Remove material")}
                  className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  onClick={() => {
                    setMaterialUrl("");
                    setMaterialName("");
                    setUploadError(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {uploadError ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{uploadError}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Optional. Students see this material on their schedule for that day.",
                )}
              </p>
            )}
          </div>
        ) : null}

        {showNotes ? (
          <div
            className={
              isGrid
                ? "min-w-0 space-y-1.5 md:col-span-2 lg:col-span-3"
                : "min-w-0 space-y-2"
            }
          >
            <Label htmlFor="log-notes">{t("Comment / internal note")}</Label>
            <Textarea
              id="log-notes"
              rows={isGrid ? 2 : undefined}
              className="w-full min-w-0 max-w-full box-border"
              placeholder={t(
                "Administrative note, e.g. exam room change or a reminder…",
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("Optional. Internal only — students never see this.")}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={
          isGrid
            ? "flex flex-wrap items-center justify-end gap-2 border-t pt-3"
            : "flex items-center justify-end gap-3 pt-2"
        }
      >
        {showCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("Cancel")}
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => {
            const selected = classes.find((c) => c.label === className);
            // Editing an entry whose class is no longer offered keeps its
            // stored scope, but only while the label itself is unchanged.
            const keepsExisting = className === (initial?.className ?? "");
            onSubmit({
              course: course || undefined,
              sessionType,
              className: className || undefined,
              programId:
                selected?.programId ||
                (keepsExisting ? initial?.programId : undefined),
              trainingId:
                selected?.trainingId ||
                (keepsExisting ? initial?.trainingId : undefined),
              sessionTime: formatSessionTime(startTime, endTime),
              roomName:
                sessionType === "Online"
                  ? ONLINE_SESSION_LOCATION
                  : roomName || DEFAULT_PLANNING_CLASSROOM,
              content: content.trim(),
              // Omitted when there is nothing to say (and nothing stored), so a
              // database without the notes migration keeps saving sessions.
              ...(showNotes && (notes.trim() || initial?.notes)
                ? { notes: notes.trim() }
                : {}),
              // Teacher dialog: the material follows the category, so switching
              // an entry to Exam/PFE clears a previously attached course file.
              ...(showCategory
                ? {
                    materialUrl:
                      category === "course" ? materialUrl.trim() : "",
                    materialName:
                      category === "course" ? materialName.trim() : "",
                  }
                : {}),
              ...(teacherOptions ? { teacherId: teacherId || undefined } : {}),
            });
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
