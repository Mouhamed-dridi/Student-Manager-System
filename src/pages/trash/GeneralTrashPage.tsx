import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  hardDeletePublication,
  hardDeleteStudents,
  hardDeleteTeachers,
  listGeneralTrash,
  restorePublication,
  restoreStudents,
  restoreTeachers,
  type TrashCapabilities,
  type TrashItem,
} from "@/lib/api";

const TYPE_LABELS: Record<TrashItem["table"], string> = {
  students: "Student",
  teachers: "Teacher",
  publications: "Publication",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function GeneralTrashPage() {
  const [data, setData] = useState<{
    items: TrashItem[];
    capabilities: TrashCapabilities;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<TrashItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => listGeneralTrash();

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.items ?? [];
    return (data?.items ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q),
    );
  }, [data, search]);

  const runAction = async (
    target: TrashItem,
    action: "restore" | "purge",
  ) => {
    setSaving(true);
    setError(null);
    try {
      if (action === "restore") {
        if (target.table === "students") await restoreStudents([target.id]);
        else if (target.table === "teachers") await restoreTeachers([target.id]);
        else await restorePublication(target.id);
      } else {
        if (target.table === "students") await hardDeleteStudents([target.id]);
        else if (target.table === "teachers") await hardDeleteTeachers([target.id]);
        else await hardDeletePublication(target.id);
      }
      setData(await load());
      setRestoreTarget(null);
      setPurgeTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const supportedModules = data
    ? [data.capabilities.students, data.capabilities.teachers, data.capabilities.publications]
    : [];
  const noneSupported = data !== null && supportedModules.every((v) => !v);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Trash</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Deleted students, teachers and publications are kept here for recovery.
        Restore an item or permanently delete it.
      </p>

      <div className="mt-4">{error && <DataError message={error} />}</div>

      <div className="mt-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search the trash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {data === null ? (
          !error && <DataLoading label="Loading trash…" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {noneSupported
              ? "Trash is not available on this database — the students/teachers/publications tables have no is_deleted/deleted_at columns, so deletions are only tracked for the current session."
              : data.items.length === 0
                ? "The trash is empty."
                : "No items match your search."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Deleted At</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={`${item.table}-${item.id}`}>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {TYPE_LABELS[item.table]}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.detail || "—"}</TableCell>
                  <TableCell>{formatDate(item.deletedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Restore"
                        aria-label={`Restore ${item.name}`}
                        disabled={saving}
                        onClick={() => setRestoreTarget(item)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete permanently"
                        aria-label={`Permanently delete ${item.name}`}
                        disabled={saving}
                        onClick={() => setPurgeTarget(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this item?</AlertDialogTitle>
            <AlertDialogDescription>
              “{restoreTarget?.name}” will move back to its active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={() => restoreTarget && runAction(restoreTarget, "restore")}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              “{purgeTarget?.name}” will be destroyed permanently. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={() => purgeTarget && runAction(purgeTarget, "purge")}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}