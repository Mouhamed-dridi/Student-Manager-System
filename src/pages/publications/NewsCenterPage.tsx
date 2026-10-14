import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError, DataLoading } from "@/components/DataState";
import { errorMessage, listPublications, softDeletePublication } from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  RECIPIENT_LABELS,
} from "@/pages/publications/publicationTypes";
import type { Publication } from "@/pages/publications/publicationTypes";
import EditPublicationDialog from "@/pages/publications/EditPublicationDialog";

export default function NewsCenterPage() {
  const [publications, setPublications] = useState<Publication[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Publication | null>(null);

  useEffect(() => {
    listPublications()
      .then(setPublications)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await softDeletePublication(id);
      setPublications(await listPublications());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">News Center</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every published announcement, newest first.
      </p>

      {loadError && (
        <div className="mt-4">
          <DataError message={loadError} />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <DataError message={error} />
        </div>
      )}

      {publications === null ? (
        !loadError && <DataLoading label="Loading publications…" />
      ) : publications.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No publications created yet.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publications.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    {NOTIFICATION_TYPE_LABELS[p.type] ?? "Info / News"}
                  </TableCell>
                  <TableCell>
                    {new Date(p.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {p.recipients.map((r) => RECIPIENT_LABELS[r]).join(", ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(p)}
                        aria-label="Edit publication"
                      >
                        <Pencil className="w-4 h-4 text-blue-600 hover:text-blue-800 cursor-pointer" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          }
                        />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete publication?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{p.title}" will be moved to the Trash. You can
                            restore it later or permanently delete from there.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <EditPublicationDialog
          publication={editing}
          onSaved={() => {
            listPublications()
              .then(setPublications)
              .catch((err) => setError(errorMessage(err)));
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
