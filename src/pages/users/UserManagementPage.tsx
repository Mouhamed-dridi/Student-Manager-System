import { useState } from "react";
import { Eye, EyeOff, Trash2, UserPlus } from "lucide-react";
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
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Student } from "@/pages/students/StudentForm";
import CreateAccountDialog from "./CreateAccountDialog";
import ResetPasswordDialog from "./ResetPasswordDialog";
import {
  deleteAccount,
  hasAccount,
  loadStudents,
  toggleBlocked,
} from "./userAccounts";

function statusBadge(blocked: boolean | undefined) {
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

export default function UserManagementPage() {
  const [students, setStudents] = useState<Student[]>(loadStudents);
  const [query, setQuery] = useState("");
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Student | null>(null);

  const refresh = () => setStudents(loadStudents());

  const accounts = students.filter(hasAccount);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? accounts.filter((s) =>
        s.fullName.toLowerCase().includes(normalizedQuery),
      )
    : accounts;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56"
          />
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card className="mt-4 max-w-xl">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No student accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use “Create Account” to give a student login access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-foreground/10">
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
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    No accounts match “{query}”.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {revealedId === s.id ? s.password : "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={
                            revealedId === s.id ? "Hide password" : "Show password"
                          }
                          onClick={() =>
                            setRevealedId(revealedId === s.id ? null : s.id)
                          }
                        >
                          {revealedId === s.id ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(s.blocked)}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toggleBlocked(s.id);
                            refresh();
                          }}
                        >
                          {s.blocked ? "Unblock" : "Block"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetTarget(s)}
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
                              <AlertDialogTitle>
                                Delete account?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes {s.fullName}'s login access
                                (password and status). Their record stays in
                                the Students page and can be given a new
                                account later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  deleteAccount(s.id);
                                  refresh();
                                }}
                              >
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
      )}

      {createOpen && (
        <CreateAccountDialog
          students={students}
          onClose={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          student={resetTarget}
          onClose={() => {
            setResetTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
