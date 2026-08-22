import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AccountCandidate } from "./CreateAccountDialog";
import AccountsTable, { type AccountsTableRow } from "./AccountsTable";
import CreateAccountDialog from "./CreateAccountDialog";
import ResetPasswordDialog from "./ResetPasswordDialog";
import {
  createAccount,
  deleteAccount,
  hasAccount,
  loadStudents,
  loadTeachers,
  resetPassword,
  toggleBlocked,
  type AccountKind,
  type AccountRecord,
} from "./userAccounts";

type TabKey = Exclude<AccountKind, never>;

function toRows(records: ReturnType<typeof loadStudents>): AccountsTableRow[] {
  return records.filter(hasAccount).map((r) => ({
    id: r.id,
    fullName: r.fullName ?? "(unnamed)",
    password: r.password,
    blocked: r.blocked,
  }));
}

function detailOf(record: AccountRecord): string {
  const program = typeof record.program === "string" ? record.program : "";
  const training = typeof record.training === "string" ? record.training : "";
  return [program, training].filter(Boolean).join(" — ");
}

export default function UserManagementPage() {
  const [students, setStudents] = useState(loadStudents);
  const [teachers, setTeachers] = useState(loadTeachers);
  const [tab, setTab] = useState<TabKey>("students");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    kind: AccountKind;
    id: string;
    fullName: string;
  } | null>(null);

  const kind = tab;
  const records = kind === "students" ? students : teachers;
  const accounts = toRows(records);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? accounts.filter((r) => r.fullName.toLowerCase().includes(normalizedQuery))
    : accounts;

  const candidates: AccountCandidate[] = records
    .filter((r) => !hasAccount(r))
    .map((r) => ({ id: r.id, fullName: r.fullName ?? "(unnamed)", detail: detailOf(r) }));

  const refresh = () => {
    setStudents(loadStudents());
    setTeachers(loadTeachers());
  };

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
        onValueChange={(value) => setTab(value as TabKey)}
        className="mt-4"
      >
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {accounts.length === 0 ? (
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
            onToggleBlock={(id) => {
              toggleBlocked(kind, id);
              refresh();
            }}
            onResetRequest={(row) =>
              setResetTarget({ kind, id: row.id, fullName: row.fullName })
            }
            onDelete={(id) => {
              deleteAccount(kind, id);
              refresh();
            }}
          />
        )}
      </div>

      {createOpen && (
        <CreateAccountDialog
          entityLabel={kind === "students" ? "student" : "teacher"}
          candidates={candidates}
          onSubmit={(id, password) => {
            createAccount(kind, id, password);
            refresh();
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
          onSubmit={(password) => {
            resetPassword(resetTarget.kind, resetTarget.id, password);
            refresh();
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
