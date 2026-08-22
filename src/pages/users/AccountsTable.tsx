import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AccountsTableRow {
  id: string;
  fullName: string;
  password?: string;
  blocked?: boolean;
}

interface AccountsTableProps {
  rows: AccountsTableRow[];
  emptyRowMessage: string;
  onToggleBlock: (id: string) => void;
  onResetRequest: (row: AccountsTableRow) => void;
  onDelete: (id: string) => void;
}

function statusBadge(blocked?: boolean) {
  if (blocked) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      Active
    </span>
  );
}

export default function AccountsTable({
  rows,
  emptyRowMessage,
  onToggleBlock,
  onResetRequest,
  onDelete,
}: AccountsTableProps) {
  const [revealedId, setRevealedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Password</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {emptyRowMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.fullName}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {revealedId === row.id ? row.password : "••••••••"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        revealedId === row.id
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() =>
                        setRevealedId(revealedId === row.id ? null : row.id)
                      }
                    >
                      {revealedId === row.id ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </span>
                </TableCell>
                <TableCell>{statusBadge(row.blocked)}</TableCell>
                <TableCell>
                  <span className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleBlock(row.id)}
                    >
                      {row.blocked ? "Unblock" : "Block"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResetRequest(row)}
                    >
                      Reset Password
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button variant="ghost" size="icon-sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete account</span>
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes {row.fullName}'s login access
                            (password and status). The underlying record stays
                            and can be given a new account later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(row.id)}>
                            Delete Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
