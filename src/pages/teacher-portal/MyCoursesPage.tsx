import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Upload, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CourseCardsGrid from "@/components/CourseCardsGrid";
import CourseDetailPage from "@/components/CourseDetailPage";
import SkillsInput from "@/components/SkillsInput";
import { DataError, DataLoading } from "@/components/DataState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  SegmentedTabsList,
  SegmentedTabsTrigger,
} from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteTeacherCourse,
  errorMessage,
  listBranches,
  listBranchMaterials,
  listTeacherCourses,
  resolveTeacherTeachingContext,
  saveTeacherCourse,
  subscribeToTable,
  toMaterialList,
  uploadCourseMaterial,
  uploadCourseThumbnail,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { useNestedView } from "@/hooks/viewHistory";
import type {
  BranchMaterialRecord,
} from "@/lib/api";
import {
  normalizeCourseName,
  subjectNamesMatch,
} from "@/lib/courseDisplay";
import type {
  CourseMaterial,
  ScheduledCourseView,
  TeacherCourseRecord,
} from "@/lib/trainings";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

// Covers are shown at ~380px in the card grid, so 1200px keeps them sharp on
// 2x/3x displays while still being a reasonable Storage object.
const THUMBNAIL_MAX_WIDTH = 1200;

// Course-detail metadata. The values are stored as the same short display
// strings the columns already hold in Supabase (see the courses block in
// supabase/schema.sql) and are shown as-is in the student portal.
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Expert"];

const FORMAT_OPTIONS = ["Video", "Document", "Video & Document"];

// Downscales a picked image to at most 1200px wide and encodes a high-quality
// JPEG for Supabase Storage. The card and detail view serve this original
// object directly (no render/image transform), so it must already be crisp.
async function fileToThumbnailJpeg(file: File): Promise<Blob> {
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
  const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / img.width);
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
      0.85,
    ),
  );
}

type ViewKey = "my-courses" | "add-course" | "detail";

interface CourseFormValues {
  name: string;
  description: string;
  /** Material (matière) the course is taught under. */
  subject?: string;
  program: string;
  training: string;
  subtitle?: string;
  level?: string;
  duration?: string;
  format?: string;
  skills?: string[];
  syllabus?: string;
  thumbnail?: string;
  /** Newly picked image, downscaled to a JPEG blob, to upload to Storage. */
  thumbnailFile?: Blob;
  /** Picked course materials: metadata the teacher can type/name, upgraded to a
   *  real upload with a publicly reachable url when a file was picked. */
  materials?: (CourseMaterial & { file?: File })[];
}

interface CourseFormProps {
  initialData?: TeacherCourseRecord;
  /** Locked program/training pulled from the logged-in teacher's profile. */
  lockedAssignment?: { program?: string; training?: string };
  /**
   * Materials (matières) of the teacher's class, or the teacher's own assigned
   * materials. The course title stays free text; this picker says which
   * matière it belongs to, which is what the student Cours filter groups by.
   */
  materialOptions?: string[];
  /** Matière preselected for a new course: an assigned branch material, else
   *  the teacher's specialty, so transverse teachers do not have to hunt for
   *  their own material in the picker. */
  defaultMaterial?: string;
  /** Whether the teacher teaches anything at all (profile class, material, or
   *  a planning session). False is the only case that shows the amber notice. */
  hasTeachingAssignment?: boolean;
  onSubmit: (values: CourseFormValues) => Promise<void>;
  onCancel: () => void;
}

function CourseForm({
  initialData,
  lockedAssignment,
  materialOptions,
  defaultMaterial,
  hasTeachingAssignment = true,
  onSubmit,
  onCancel,
}: CourseFormProps) {
  // Program/training come exclusively from the logged-in teacher's profile:
  // the form has no selectors, so the submitted payload always matches the
  // teacher's assignment. Teachers without an assignment (or the original
  // class of a course being edited) keep whatever the record carries today.
  const assignment =
    lockedAssignment?.program && lockedAssignment.training
      ? {
          program: lockedAssignment.program,
          training: lockedAssignment.training,
        }
      : null;
  const [name, setName] = useState(initialData?.name ?? "");
  const [subject, setSubject] = useState(initialData?.subject ?? "");
  // A new course starts on the teacher's own material (assigned branch
  // material, else specialty). Derived rather than stored so a catalog that
  // resolves after mount still fills it in, while an explicit pick always wins.
  // Editing never changes the stored matière.
  const effectiveSubject = subject || (initialData ? "" : defaultMaterial ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? "");
  const [level, setLevel] = useState(initialData?.level ?? "");
  // courses.duration is a display string ("1h 30m"), not a minute count, so it
  // is edited as free text and any existing value round-trips untouched.
  const [duration, setDuration] = useState(initialData?.duration ?? "");
  const [deliveryFormat, setDeliveryFormat] = useState(
    initialData?.format ?? "",
  );
  // Skills are typed as a comma-separated list and split on save, so the form
  // needs no chip editor.
  // A tag list, not free text: each skill is committed with Enter or a comma
  // and stored as its own entry in courses.skills (text[]).
  const [skills, setSkills] = useState<string[]>(initialData?.skills ?? []);
  const [syllabus, setSyllabus] = useState(initialData?.syllabus ?? "");
  const [pickedImage, setPickedImage] = useState<{
    name: string;
    file: Blob;
  } | null>(null);
  // Attached course materials. A picked file keeps its `File` handle so the
  // save flow can upload it to Storage; materials restored from an existing
  // course carry only the metadata ({name,type}) that was persisted.
  const [materials, setMaterials] = useState<(CourseMaterial & { file?: File })[]>(
    // Normalised, not `?? []`: an older course row can hand back a JSON *string*
    // for materials, and the form maps over this on every render. `file` is
    // optional on CourseMaterial, so no cast is needed.
    toMaterialList(initialData?.materials) ?? [],
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const programValue = assignment?.program ?? initialData?.program ?? "";
  const trainingValue = assignment?.training ?? initialData?.training ?? "";
  // Keep a legacy/other subject selectable while editing even when it is not
  // in this teacher's current material list.
  const materialChoices = [...(materialOptions ?? [])];
  const currentSubject = effectiveSubject.trim();
  if (currentSubject && !materialChoices.includes(currentSubject)) {
    materialChoices.unshift(currentSubject);
  }
  const materialItems = materialChoices.map((name) => ({ value: name, label: name }));
  // Linking the course to a matériau is the whole point of the filter; require
  // it whenever the class/material schema could be read (the picker is empty
  // on older databases that have not run the branches migration yet).
  const valid =
    name.trim() !== "" && (materialChoices.length === 0 || currentSubject !== "");

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground">
        {assignment
          ? "Program and training are taken from your profile — no need to pick them."
          : "Program and training now come from your profile automatically."}
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="course-title">Title</Label>
          <Input
            id="course-title"
            placeholder="e.g. Implementing an SAP Solution"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Material (matière)</Label>
          <Select
            value={effectiveSubject}
            items={materialItems}
            onValueChange={(value) => setSubject(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a material" />
            </SelectTrigger>
            <SelectContent>
              {materialItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {materialChoices.length > 0
              ? "Students see this course under the selected material."
              : "No material was found for your class yet. Ask the administration to add it under Materials before linking courses."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="course-description">
            Course Description
          </Label>
          <Textarea
            id="course-description"
            placeholder="What does this course cover?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-subtitle">Subtitle (optional)</Label>
          <Input
            id="course-subtitle"
            placeholder="e.g. Learn to build interfaces with HTML &amp; CSS"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Level</Label>
            <Select
              value={level}
              onValueChange={(value) => setLevel(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-duration">Duration</Label>
            <Input
              id="course-duration"
              placeholder="e.g. 1h 30m"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={deliveryFormat}
              onValueChange={(value) => setDeliveryFormat(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-skills">Skills (optional)</Label>
          <SkillsInput
            id="course-skills"
            value={skills}
            onChange={setSkills}
            placeholder="e.g. Responsive layout, Semantic HTML, Flexbox"
          />
          <p className="text-xs text-muted-foreground">
            Type a skill and press Enter or a comma to add it. They appear under
            &ldquo;Skills you&rsquo;ll gain&rdquo; in the student portal.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-syllabus">Syllabus (optional)</Label>
          <Textarea
            id="course-syllabus"
            placeholder={
              "One topic per line, e.g.\nWeek 1 · HTML structure\nWeek 2 · CSS layout"
            }
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            rows={5}
          />
        </div>
        {assignment ? (
          <>
            <div className="space-y-2">
              <Label>Program (from your profile)</Label>
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium">
                {assignment.program}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Training (from your profile)</Label>
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium">
                {assignment.training}
              </div>
            </div>
          </>
        ) : hasTeachingAssignment ? (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Your class is not set on your profile. The course is recorded without
            a program/training and appears under the material selected above.
          </p>
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your profile has no assigned program, training, material or planning
            session yet, so this course will be recorded without one until the
            center assigns you a class.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="course-thumbnail">Thumbnail image (optional)</Label>
          <Input
            id="course-thumbnail"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              fileToThumbnailJpeg(file)
                .then((blob) => setPickedImage({ name: file.name, file: blob }))
                .catch(() => {
                  setPickedImage(null);
                  input.value = "";
                });
            }}
          />
          {pickedImage ? (
            <p className="text-xs text-muted-foreground">
              Selected image: {pickedImage.name}
            </p>
          ) : initialData?.thumbnail ? (
            <p className="text-xs text-muted-foreground">
              This course already has a custom thumbnail.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-materials">Course Materials</Label>
          <Input
            id="course-materials"
            type="file"
            multiple
            accept="video/*,.pdf,.doc,.docx"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length === 0) return;
              setMaterials((prev) => [
                ...prev,
                ...files.map((f) => ({ name: f.name, type: f.type, file: f })),
              ]);
              e.currentTarget.value = "";
            }}
          />
          {materials.length > 0 ? (
            <ul className="space-y-1">
              {materials.map((m, i) => (
                <li
                  key={`${m.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm"
                >
                  <span className="truncate">{m.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${m.name}`}
                    onClick={() =>
                      setMaterials((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {saveError ? (
          <p className="text-sm text-destructive">{saveError}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError(null);
              const values: CourseFormValues = {
                name: name.trim(),
                description: description.trim(),
                subject: effectiveSubject.trim() || undefined,
                program: programValue,
                training: trainingValue,
                subtitle: subtitle.trim() || undefined,
                level: level || undefined,
                duration: duration.trim() || undefined,
                format: deliveryFormat || undefined,
                // undefined (not an empty array) so the column is cleared
                // rather than written as an empty text[].
                skills: skills.length > 0 ? skills : undefined,
                syllabus: syllabus.trim() || undefined,
              };
              if (pickedImage) values.thumbnailFile = pickedImage.file;
              values.materials = materials.length > 0 ? materials : undefined;
              try {
                await onSubmit(values);
              } catch (err) {
                setSaveError(errorMessage(err));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : initialData ? "Save Changes" : "Add Course"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MyCoursesPage() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  // Program/training the teacher teaches: profile value, else derived from
  // the teacher's own courses (resolved once the session record loads).
  const [assignment, setAssignment] = useState<{
    program: string;
    training: string;
    programId?: string;
    trainingId?: string;
  } | null>(null);
  // Materials (matières) the course picker offers: the teacher's class branch,
  // narrowed to the materials assigned to this teacher when there are any.
  const [classMaterials, setClassMaterials] = useState<BranchMaterialRecord[]>([]);
  // First of the teacher's own materials, else their specialty: preselected in
  // the Add Course form.
  const [preferredMaterial, setPreferredMaterial] = useState("");
  // Optimistic until the full context resolves, so the amber "no assignment"
  // notice never flashes for a teacher who is staffed through materials or
  // planning.
  const [hasTeachingAssignment, setHasTeachingAssignment] = useState(true);
  const [view, setView] = useState<ViewKey>("my-courses");
  const [editing, setEditing] = useState<TeacherCourseRecord | null>(null);
  // Course shown in the full-page detail view (instead of the card grid).
  const [detail, setDetail] = useState<ScheduledCourseView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledCourseView | null>(
    null,
  );
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The full-page course detail is a sub-page of the Courses section, so it
  // goes on the shared history stack: the header arrow then does exactly what
  // the detail's own Back button does.
  useNestedView(
    view === "detail" && detail !== null,
    "course-detail",
    "Course details",
    () => {
      setDetail(null);
      setView("my-courses");
    },
  );

  const refresh = useCallback(async (teacherId?: string) => {
    try {
      setError(null);
      // Strictly this teacher's own courses — cross-teacher rows are never
      // fetched (server-side .eq("teacher_id", ...)).
      const all = await listTeacherCourses({ teacherId });
      setCourses(all);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled) return;
        if (!record) {
          setTeacher(null);
          return;
        }
        setTeacher(record);
        resolveTeacherTeachingContext(record.id)
          .then((ctx) => {
            if (cancelled) return;
            setHasTeachingAssignment(ctx.hasAssignment);
            setPreferredMaterial(ctx.materials[0] ?? record.specialty ?? "");
            if (ctx.program && ctx.training) {
              setAssignment({
                program: ctx.program,
                training: ctx.training,
                programId: ctx.programId,
                trainingId: ctx.trainingId,
              });
            }
          })
          .catch(() => {});
        void refresh(record.id);
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Load the material catalog once the teacher and their class are known. The
  // materials assigned to this teacher ANYWHERE win, because a material is tied
  // to the teacher rather than to one branch: "ERP Consulting" is taught in the
  // Commerce international class while this teacher's profile resolves to the
  // IT-support class, so a branch-only list would never offer it. Only when the
  // teacher has no assignment at all does the class's full catalog apply, so
  // they can still link a new course.
  const assignmentTrainingId = assignment?.trainingId;
  const assignmentTraining = assignment?.training;
  const teacherId = teacher?.id;
  useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    Promise.all([listBranches(), listBranchMaterials()])
      .then(([branches, all]) => {
        if (cancelled) return;
        const wantedTraining = normalizeCourseName(assignmentTraining);
        const branch = branches.find(
          (b) =>
            (assignmentTrainingId && b.trainingId === assignmentTrainingId) ||
            (wantedTraining &&
              assignmentTraining !== undefined &&
              subjectNamesMatch(b.name, assignmentTraining)),
        );
        const inBranch = branch
          ? all.filter((m) => m.branchId === branch.id)
          : [];
        const mine = all.filter(
          (m) => m.teacherId === teacherId && m.name.trim() !== "",
        );
        const offered = mine.length > 0 ? mine : inBranch;
        // The same material exists in several branches; the course only stores
        // its name, so one option per normalized name is enough.
        const seen = new Set<string>();
        setClassMaterials(
          offered.filter((m) => {
            const key = normalizeCourseName(m.name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
      })
      .catch(() => {
        // Branches schema is optional; the picker stays empty and the form
        // still saves until supabase/branches-materials-migration.sql runs.
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId, assignmentTrainingId, assignmentTraining]);

  // Live updates: courses added/edited/removed in another browser appear
  // here without a manual refresh. Runs once the teacher record resolves.
  useEffect(() => {
    if (!teacher) return;
    return subscribeToTable("courses", () => void refresh(teacher?.id));
  }, [teacher, refresh]);

  // Quiet fallback: refresh courses once if the tab regains focus after a
  // while, in case the realtime connection dropped while backgrounded.
  useRefetchOnFocus(() => {
    if (teacher) void refresh(teacher.id);
  });

  if (teacher === null) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Courses</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Your teacher record could not be found. It may have been removed by
          the administration.
        </p>
      </div>
    );
  }

  if (teacher === undefined) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Courses</h2>
        <DataLoading label="Loading courses…" />
      </div>
    );
  }

  const handleViewChange = (value: string) => {
    const next = (value as ViewKey) ?? "my-courses";
    if (next === "add-course") setEditing(null);
    if (next === "my-courses") setDetail(null);
    setView(next);
  };

  const startEdit = (course: ScheduledCourseView) => {
    if (!course.id) return;
    const record = (courses ?? []).find((r) => r.id === course.id);
    if (!record) return;
    setEditing(record as TeacherCourseRecord);
    setDetail(null);
    setView("add-course");
  };

  // The material picker lives inside the edit form (there is no separate upload
  // dialog), so this opens the form and brings that field into view.
  const startMaterialUpload = (course: ScheduledCourseView) => {
    startEdit(course);
    window.setTimeout(() => {
      document
        .getElementById("course-materials")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const handleSubmit = async (values: CourseFormValues): Promise<void> => {
    const { thumbnailFile, ...courseValues } = values;
    let record: TeacherCourseRecord;
    if (editing) {
      // Edits keep the course's publish date; a newly uploaded thumbnail
      // replaces the old one. Program/Training are picked in the form itself.
      record = { ...editing, ...courseValues };
    } else {
      record = {
        id: crypto.randomUUID(),
        teacherId: teacher.id,
        published: new Date().toISOString(),
        // Already-resolved class ids, so saving does not have to look them up
        // again before it can insert.
        programId: assignment?.programId,
        trainingId: assignment?.trainingId,
        ...courseValues,
      };
    }
    if (thumbnailFile) {
      record.thumbnail = await uploadCourseThumbnail(thumbnailFile, teacher.id);
    }
    if (record.materials && record.materials.length > 0) {
      // Upload any material that was attached as a real file (teacher just
      // picked it) and backfill its public URL. Materials edited in place that
      // came from an earlier save already carry a URL and are left untouched.
      record.materials = await Promise.all(
        (record.materials as (CourseMaterial & { file?: File })[]).map(
          async (m) => {
            if (!m.file) return m;
            const url = await uploadCourseMaterial(m.file, m.name, teacher.id);
            return { name: m.name, type: m.type, url };
          },
        ),
      );
    }
    // The write has completed (or thrown) by now; close the form immediately
    // and let the list refresh in the background instead of keeping the
    // button on "Saving…" for another round-trip.
    await saveTeacherCourse(record);
    setEditing(null);
    setDetail(null);
    setView("my-courses");
    void refresh(teacher?.id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setError(null);
      await deleteTeacherCourse(deleteTarget.id);
      await refresh(teacher?.id);
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  const ownCourses = courses ?? [];

  return (
    <div>
      <h2 className="text-2xl font-semibold">Courses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Teaching {teacher.jobTitle || teacher.specialty || "—"}
      </p>

      {view === "detail" && detail ? (
        <div className="mt-4">
          <CourseDetailPage
            course={detail}
            onBack={() => {
              setDetail(null);
              setView("my-courses");
            }}
            backLabel="Back to my courses"
            actions={
              detail.id !== undefined && detail.teacherId === teacher.id ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(detail)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Course
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startMaterialUpload(detail)}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Material
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteTarget(detail)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    Delete Course
                  </Button>
                </>
              ) : null
            }
          />
        </div>
      ) : (
        <Tabs value={view} onValueChange={handleViewChange} className="mt-4">
        <SegmentedTabsList>
          <SegmentedTabsTrigger value="my-courses">My Courses</SegmentedTabsTrigger>
          <SegmentedTabsTrigger value="add-course">
            {editing ? "Edit Course" : "Add Course"}
          </SegmentedTabsTrigger>
        </SegmentedTabsList>

        <TabsContent value="my-courses">
          {error && (
            <div className="mt-4">
              <DataError message={error} />
            </div>
          )}
          {courses === null ? (
            !error && <DataLoading label="Loading courses…" />
          ) : ownCourses.length === 0 ? (
            <Card className="mt-4 max-w-xl">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">No courses scheduled yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first course from the Add Course tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4">
              <CourseCardsGrid
                courses={ownCourses}
                onOpenCourse={(c) => {
                  setDetail(c);
                  setView("detail");
                }}
                renderActions={(c) =>
                  c.id !== undefined && c.teacherId === teacher.id ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label={`Edit ${c.name}`}
                        className="bg-background"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${c.name}`}
                        className="bg-background"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : null
                }
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="add-course">
          <CourseForm
            key={editing?.id ?? "new"}
            initialData={editing ?? undefined}
            lockedAssignment={
              assignment
                ? { program: assignment.program, training: assignment.training }
                : undefined
            }
            materialOptions={classMaterials.map((material) => material.name)}
            defaultMaterial={
              preferredMaterial || classMaterials[0]?.name || undefined
            }
            hasTeachingAssignment={hasTeachingAssignment}
            onSubmit={handleSubmit}
            onCancel={() => {
              setEditing(null);
              setView("my-courses");
            }}
          />
        </TabsContent>
        </Tabs>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{deleteTarget?.name}” from your
              schedule. Students in this course's training will no longer see
              it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
