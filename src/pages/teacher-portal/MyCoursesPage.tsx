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
import {
  deleteTeacherCourse,
  errorMessage,
  listTeacherCourses,
  saveTeacherCourse,
  subscribeToTable,
} from "@/lib/api";
import { loadScheduledCourses } from "@/lib/trainings";
import type {
  CourseMaterial,
  ScheduledCourseView,
  TeacherCourseRecord,
} from "@/lib/trainings";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { loadCurrentTeacher } from "./currentTeacher";

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const TIME_SLOTS = [
  "08:00–10:00",
  "10:15–12:15",
  "13:00–15:00",
  "15:15–17:15",
];

const THUMBNAIL_MAX_WIDTH = 400;

async function fileToThumbnailDataUrl(file: File): Promise<string> {
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
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

type ViewKey = "my-courses" | "add-course";

interface CourseFormValues {
  name: string;
  day: string;
  time: string;
  thumbnail?: string;
  materials?: CourseMaterial[];
}

interface CourseFormProps {
  initialData?: TeacherCourseRecord;
  onSubmit: (values: CourseFormValues) => boolean | Promise<boolean>;
  onCancel: () => void;
}

function CourseForm({ initialData, onSubmit, onCancel }: CourseFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [day, setDay] = useState(
    initialData?.day && DAY_OPTIONS.includes(initialData.day)
      ? initialData.day
      : DAY_OPTIONS[0],
  );
  const [time, setTime] = useState(
    initialData?.time && TIME_SLOTS.includes(initialData.time)
      ? initialData.time
      : TIME_SLOTS[0],
  );
  const [pickedImage, setPickedImage] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>(
    initialData?.materials ?? [],
  );
  const [saveError, setSaveError] = useState(false);

  const valid = name.trim() !== "";

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground">
        Program and Training are taken from your own assignment. This course
        is visible to students in your class.
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
          <Label>Day</Label>
          <Select
            value={day}
            onValueChange={(value) => setDay(value ?? DAY_OPTIONS[0])}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <Select
            value={time}
            onValueChange={(value) => setTime(value ?? TIME_SLOTS[0])}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select time slot" />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              fileToThumbnailDataUrl(file)
                .then((dataUrl) => setPickedImage({ name: file.name, dataUrl }))
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
                ...files.map((f) => ({ name: f.name, type: f.type })),
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
          <p className="text-sm text-destructive">
            Couldn't save the course — please try again.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            disabled={!valid}
            onClick={() => {
              setSaveError(false);
              const values: CourseFormValues = {
                name: name.trim(),
                day,
                time,
              };
              if (pickedImage) values.thumbnail = pickedImage.dataUrl;
              values.materials = materials.length > 0 ? materials : undefined;
              if (!onSubmit(values)) setSaveError(true);
            }}
          >
            {initialData ? "Save Changes" : "Add Course"}
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
  const [view, setView] = useState<ViewKey>("my-courses");
  const [editing, setEditing] = useState<TeacherCourseRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledCourseView | null>(
    null,
  );
  const [courses, setCourses] = useState<ScheduledCourseView[] | null>(null);
  const [records, setRecords] = useState<TeacherCourseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (record: Teacher) => {
      try {
        setError(null);
        const [list, allRecords] = await Promise.all([
          loadScheduledCourses(record.program, record.training),
          listTeacherCourses(),
        ]);
        setCourses(list);
        setRecords(allRecords);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [],
  );

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
        await refresh(record);
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
    return subscribeToTable("courses", () => void refresh(teacher));
  }, [teacher, refresh]);

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
    setView(next);
  };

  const startEdit = (course: ScheduledCourseView) => {
    if (!course.id) return;
    const record = records.find((r) => r.id === course.id);
    if (!record) return;
    setEditing(record);
    setView("add-course");
  };

  const handleSubmit = async (values: CourseFormValues): Promise<boolean> => {
    let record: TeacherCourseRecord;
    if (editing) {
      // Edits keep the course scoped to its original class and keep its
      // original publish date; an uploaded thumbnail replaces the old one.
      record = { ...editing, ...values };
    } else {
      record = {
        id: crypto.randomUUID(),
        teacherId: teacher.id,
        program: teacher.program,
        training: teacher.training,
        published: new Date().toISOString(),
        ...values,
      };
    }
    const ok = await saveTeacherCourse(record);
    if (!ok) return false;
    setEditing(null);
    setView("my-courses");
    await refresh(teacher);
    return true;
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setError(null);
      await deleteTeacherCourse(deleteTarget.id);
      await refresh(teacher);
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Courses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Teaching {teacher.training || "—"} ({teacher.program})
      </p>

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
          ) : courses.length === 0 ? (
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
                courses={courses}
                training={teacher.training}
                showMaterials
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
            onSubmit={handleSubmit}
            onCancel={() => {
              setEditing(null);
              setView("my-courses");
            }}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{deleteTarget?.name}” from your
              class schedule. Students in this training will no longer see it.
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
