// Operator "Branches" — the full-page class record.
//
// The grid card opens this page instead of the timetable: it is the class file
// (materials, the teacher of each material, and the enrolled roster) and the
// timetable is one button away. It replaces the section content rather than
// opening a modal, so the portal header and its back arrow stay visible;
// BranchesPage registers nothing here — this page registers itself with
// `useNestedView`, and a student profile opened from the roster stacks on top.
//
// Deliberately monochrome (zinc-950 / zinc-800 / white): this is the operator's
// "class file" surface, the one place in the app drawn as a document instead of
// a themed card. Everything else keeps the shared design tokens.

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UserAvatar from "@/components/UserAvatar";
import StudentProfilePage from "@/components/StudentProfilePage";
import { useNestedView } from "@/hooks/viewHistory";
import {
  assignBranchMaterialTeacher,
  deleteBranchMaterial,
  errorMessage,
  saveBranchMaterial,
  type BranchMaterialRecord,
  type BranchRecord,
} from "@/lib/api";
import { useUserProfiles } from "@/lib/userProfile";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import BranchLevelBadge from "./BranchLevelBadge";

/** Select sentinel: a material nobody has been assigned to yet. */
const UNASSIGNED = "__unassigned";

interface BranchDetailPageProps {
  branch: BranchRecord;
  /** Every material of every branch; this page only renders its own. */
  materials: BranchMaterialRecord[];
  teachers: Teacher[];
  /** Students whose `training_id` matches the branch's training. */
  enrolledStudents: Student[];
  onBack: () => void;
  onOpenTimetable: () => void;
  /** Refetch the parent's data after a write so the grid and page agree. */
  onReload: () => Promise<void>;
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

export default function BranchDetailPage({
  branch,
  materials,
  teachers,
  enrolledStudents,
  onBack,
  onOpenTimetable,
  onReload,
}: BranchDetailPageProps) {
  const teacherProfiles = useUserProfiles("teacher");
  const studentProfiles = useUserProfiles("student");

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTeacherId, setDraftTeacherId] = useState<string>(UNASSIGNED);
  const [saving, setSaving] = useState(false);
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<BranchMaterialRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The roster profile stacks on top of this page: the header arrow pops the
  // profile first, then the class file.
  useNestedView(true, "branch-detail", branch.name, onBack);
  useNestedView(
    selectedStudentId !== null,
    "student-profile",
    "Student profile",
    () => setSelectedStudentId(null),
  );

  const branchMaterials = materials.filter(
    (material) => material.branchId === branch.id,
  );
  const roster = enrolledStudents
    .filter((student) => student.trainingId === branch.trainingId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  // Resolved by id, not captured, so a save in the profile sheet shows the new
  // name/photo here as soon as the parent's refetch lands.
  const selectedStudent = selectedStudentId
    ? (enrolledStudents.find((student) => student.id === selectedStudentId) ??
      null)
    : null;
  const teacherIds = new Set(
    branchMaterials
      .map((material) => material.teacherId)
      .filter((id): id is string => Boolean(id)),
  );
  const teacherById = new Map(
    teachers.map((teacher) => [teacher.id, teacher]),
  );
  // Base UI's Select.Value renders the raw value unless it can map it to a
  // label, so the trigger would show a uuid for an assigned teacher.
  const teacherOptions = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...teachers.map((teacher) => ({
      value: teacher.id,
      label: teacher.fullName,
    })),
  ];
  const teacherLabel = (value: string | null) =>
    value === UNASSIGNED
      ? "Unassigned"
      : (teacherById.get(value ?? "")?.fullName ?? "Unknown teacher");

  const openAddDialog = () => {
    setDraftName("");
    setDraftDescription("");
    setDraftTeacherId(UNASSIGNED);
    setError(null);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!draftName.trim()) {
      setError("Give the material a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBranchMaterial({
        branchId: branch.id,
        name: draftName,
        description: draftDescription,
        teacherId: draftTeacherId === UNASSIGNED ? null : draftTeacherId,
      });
      await onReload();
      setAddOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (material: BranchMaterialRecord, value: unknown) => {
    const teacherId = value === UNASSIGNED ? null : String(value ?? "");
    setBusyMaterialId(material.id);
    setError(null);
    try {
      await assignBranchMaterialTeacher(material.id, teacherId || null);
      await onReload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyMaterialId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError(null);
      await deleteBranchMaterial(deleteTarget.id);
      await onReload();
    } catch (err) {
      setError(errorMessage(err));
    }
    setDeleteTarget(null);
  };

  if (selectedStudent) {
    return (
      <StudentProfilePage
        student={selectedStudent}
        backLabel="Back to class"
        onBack={() => setSelectedStudentId(null)}
        onEdit={() => void onReload()}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
      {/* ------------------------------------------------------------ header */}
      <div className="border-b border-zinc-800 p-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Branches
        </button>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BranchLevelBadge level={branch.level} />
              <span className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
                {branch.programCode || "Branch"} track
              </span>
            </div>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              {branch.name}
            </h2>
          </div>
          <Button
            variant="outline"
            onClick={onOpenTimetable}
            className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800 hover:text-white"
          >
            <CalendarDays className="h-4 w-4" />
            Open timetable
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Total Materials"
            value={branchMaterials.length}
            icon={<BookOpen className="h-3 w-3" />}
          />
          <Stat
            label="Total Teachers"
            value={teacherIds.size}
            icon={<UserRound className="h-3 w-3" />}
          />
          <Stat
            label="Enrolled Students"
            value={roster.length}
            icon={<Users className="h-3 w-3" />}
          />
        </div>
      </div>

      {error && (
        <p className="border-b border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* ------------------------------------------------ materials & teachers */}
      <section className="border-b border-zinc-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Materials &amp; assigned teachers
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              One teacher per material — that is how one class ends up staffed
              by several teachers.
            </p>
          </div>
          <Button
            onClick={openAddDialog}
            className="bg-white text-zinc-950 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        </div>

        {branchMaterials.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-sm font-medium text-zinc-200">
              No materials yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Add the first module to this branch and assign its teacher.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
                  <th className="py-2 pr-3 font-medium">Material</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Assigned Teacher</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody>
                {branchMaterials.map((material) => {
                  const profile = material.teacherId
                    ? teacherProfiles.get(material.teacherId)
                    : undefined;
                  return (
                    <tr
                      key={material.id}
                      className="border-b border-zinc-800/70 align-top last:border-0"
                    >
                      <td className="py-3 pr-3 font-medium text-white">
                        {material.name}
                      </td>
                      <td className="max-w-md py-3 pr-3 text-xs leading-relaxed text-zinc-400">
                        {material.description || "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={material.teacherName}
                            src={profile?.avatarUrl}
                            className="h-7 w-7 border-zinc-700 bg-zinc-800 text-[10px] text-zinc-300"
                          />
                          <Select
                            value={material.teacherId ?? UNASSIGNED}
                            onValueChange={(value) =>
                              void handleAssign(material, value)
                            }
                            items={teacherOptions}
                            itemToStringLabel={(value) =>
                              teacherLabel(value)
                            }
                            disabled={busyMaterialId === material.id}
                          >
                            <SelectTrigger
                              className="h-7 w-48 border-zinc-700 bg-zinc-900 text-zinc-100"
                              aria-label={`Teacher for ${material.name}`}
                            >
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                              <SelectItem
                                value={UNASSIGNED}
                                className="focus:bg-zinc-800 focus:text-white"
                              >
                                Unassigned
                              </SelectItem>
                              {teachers.map((teacher) => (
                                <SelectItem
                                  key={teacher.id}
                                  value={teacher.id}
                                  className="focus:bg-zinc-800 focus:text-white"
                                >
                                  {teacher.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${material.name}`}
                          onClick={() => setDeleteTarget(material)}
                          className="text-zinc-500 hover:bg-zinc-800 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- the roster */}
      <section className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Enrolled students</h3>
          <p className="text-xs text-zinc-500">
            {roster.length} {roster.length === 1 ? "student" : "students"}{" "}
            matched to this class by training
          </p>
        </div>

        {roster.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-sm font-medium text-zinc-200">
              No students enrolled yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Students appear here when their training matches this branch.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                  <th className="w-32 py-2" />
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-zinc-800/70 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          name={student.fullName}
                          src={studentProfiles.get(student.id)?.avatarUrl}
                          className="h-8 w-8 border-zinc-700 bg-zinc-800 text-[11px] text-zinc-300"
                        />
                        <span className="font-medium text-white">
                          {student.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {student.email ? (
                        <a
                          href={`mailto:${student.email}`}
                          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          {student.email}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {student.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {student.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStudentId(student.id)}
                        className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      >
                        View profile
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- add material */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setAddOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add material</DialogTitle>
            <DialogDescription>
              {branch.name} · the teacher is optional and can be changed later
              from the table.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-material-name">Material name</Label>
              <Input
                id="branch-material-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="e.g. Réseaux & Cybersécurité"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-material-description">Description</Label>
              <Textarea
                id="branch-material-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="What the module covers…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned teacher</Label>
              <Select
                value={draftTeacherId}
                onValueChange={(value) => setDraftTeacherId(value ?? UNASSIGNED)}
                items={teacherOptions}
                itemToStringLabel={(value) => teacherLabel(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? "Saving…" : "Add Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete material?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” is removed from {branch.name}. The teacher
              assignment goes with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Delete Material
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
