import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
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
import CourseDetail from "@/components/CourseDetail";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteTeacherCourse,
  errorMessage,
  listTeacherCourses,
  saveTeacherCourse,
  subscribeToTable,
  teacherCourseAssignment,
  toMaterialList,
  uploadCourseMaterial,
  uploadCourseThumbnail,
} from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import type {
  CourseMaterial,
  ScheduledCourseView,
  TeacherCourseRecord,
} from "@/lib/trainings";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

const THUMBNAIL_MAX_WIDTH = 400;

// Course-detail metadata. The values are stored as the same short display
// strings the columns already hold in Supabase (see the courses block in
// supabase/schema.sql) and are shown as-is in the student portal.
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Expert"];

const FORMAT_OPTIONS = ["Video", "Document", "Video & Document"];

// Downscales a picked image to a ≤400px-wide JPEG blob that will be uploaded
// to Supabase Storage (keeps the stored thumbnails small).
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
      0.75,
    ),
  );
}

type ViewKey = "my-courses" | "add-course" | "detail";

interface CourseFormValues {
  name: string;
  description: string;
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
  onSubmit: (values: CourseFormValues) => Promise<void>;
  onCancel: () => void;
}

function CourseForm({
  initialData,
  lockedAssignment,
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
  const valid = name.trim() !== "";

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
            placeholder="e.g. JavaScript Essentials"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your profile has no assigned program or training yet, so this course
            will be recorded without one until the center assigns you a
            program/training.
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
  } | null>(null);
  const [view, setView] = useState<ViewKey>("my-courses");
  const [editing, setEditing] = useState<TeacherCourseRecord | null>(null);
  // Course shown in the full-page detail view (instead of the card grid).
  const [detail, setDetail] = useState<ScheduledCourseView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledCourseView | null>(
    null,
  );
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        teacherCourseAssignment(record.id)
          .then((a) => {
            if (!cancelled && a.program && a.training) {
              setAssignment({ program: a.program, training: a.training });
            }
          })
          .catch(() => {});
await refresh(record.id);
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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
    await saveTeacherCourse(record);
    setEditing(null);
    setDetail(null);
    setView("my-courses");
    await refresh(teacher?.id);
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
        Teaching {teacher.specialty || "—"}
      </p>

      {view === "detail" && detail ? (
        <div className="mt-4">
          <CourseDetail
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
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteTarget(detail)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    Delete
                  </Button>
                </>
              ) : null
            }
          />
        </div>
      ) : (
        <Tabs value={view} onValueChange={handleViewChange} className="mt-4">
        <TabsList>
          <TabsTrigger value="my-courses">My Courses</TabsTrigger>
          <TabsTrigger value="add-course">
            {editing ? "Edit Course" : "Add Course"}
          </TabsTrigger>
        </TabsList>

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
