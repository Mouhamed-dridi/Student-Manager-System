import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataError, DataLoading } from "@/components/DataState";
import {
  errorMessage,
  getBlocked,
  listStudents,
  listTeachers,
  updateAccount,
} from "@/lib/api";
import type { Student } from "@/pages/students/StudentForm";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { AccountKind } from "./userAccounts";
import { defaultAccountPassword, hasAccount } from "./userAccounts";
import type { AccountCandidate } from "./CreateAccountDialog";
import AccountsTable, { type AccountsTableRow } from "./AccountsTable";
import CreateAccountDialog from "./CreateAccountDialog";
import ResetPasswordDialog from "./ResetPasswordDialog";

type ManagedAccount = Student | Teacher;

function toRows(records: ManagedAccount[]): AccountsTableRow[] {
  return records.filter(hasAccount).map((r) => ({
    id: r.id,
    fullName: r.fullName ?? "(unnamed)",
    password: r.password,
    blocked: r.blocked,
  }));
}

function detailOf(record: ManagedAccount): string {
  const program = typeof record.program === "string" ? record.program : "";
  const training = typeof record.training === "string" ? record.training : "";
  return [program, training].filter(Boolean).join(" — ");
}

export default function UserManagementPage() {
  const [students, setStudents] = useState<ManagedAccount[] | null>(null);
  const [teachers, setTeachers] = useState<ManagedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AccountKind>("students");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    kind: AccountKind;
    id: string;
    fullName: string;
  } | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const [nextStudents, nextTeachers] = await Promise.all([
        listStudents(),
        listTeachers(),
      ]);
      setStudents(nextStudents);
      setTeachers(nextTeachers);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([listStudents(), listTeachers()])
      .then(([nextStudents, nextTeachers]) => {
        if (cancelled) return;
        setStudents(nextStudents);
        setTeachers(nextTeachers);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kind = tab;
  const records = kind === "students" ? students ?? [] : teachers ?? [];
  const accounts = toRows(records);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? accounts.filter((r) => r.fullName.toLowerCase().includes(normalizedQuery))
    : accounts;

  const candidates: AccountCandidate[] = records
    .filter((r) => !hasAccount(r))
    .map((r) => ({ id: r.id, fullName: r.fullName ?? "(unnamed)", detail: detailOf(r) }));

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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AccountKind)}
        className="mt-4"
      >
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {error && <DataError message={error} />}

        {students === null || teachers === null ? (
          <DataLoading label="Loading accounts…" />
        ) : accounts.length === 0 ? (
          <Card className="max-w-xl">
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">
                No {kind === "students" ? "student" : "teacher"} accounts yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use “Create Account” to give a {kind === "students" ? "student" : "teacher"}{" "}
                login access.
              </p>
            </CardContent>
          </Card>
        ) : (
          <AccountsTable
            rows={visible}
            emptyRowMessage={`No accounts match “${query}”.`}
            onToggleBlock={async (id) => {
              try {
                setError(null);
                // Flip whatever the database currently stores.
                await updateAccount(kind, id, {
                  blocked: !(await getBlocked(kind, id)),
                });
                await refresh();
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
            onResetRequest={(row) =>
              setResetTarget({ kind, id: row.id, fullName: row.fullName })
            }
            onDelete={async (id) => {
              try {
                setError(null);
                // Removes login access only — the rest of the record stays,
                // and the cleared password is never refilled automatically.
                await updateAccount(kind, id, {
                  password: null,
                  blocked: null,
                });
                await refresh();
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          />
        )}
      </div>

      {createOpen && (
        <CreateAccountDialog
          entityLabel={kind === "students" ? "student" : "teacher"}
          candidates={candidates}
          onSubmit={async (id, password) => {
            await updateAccount(kind, id, { password });
            await refresh();
          }}
          onClose={() => {
            setCreateOpen(false);
            refresh();
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          fullName={resetTarget.fullName}
          defaultPassword={defaultAccountPassword(resetTarget.kind)}
          onSubmit={async (password) => {
            await updateAccount(resetTarget.kind, resetTarget.id, { password });
            await refresh();
          }}
          onClose={() => {
            setResetTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
