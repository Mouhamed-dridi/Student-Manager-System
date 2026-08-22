import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Student } from "@/pages/students/StudentForm";
import {
  DEFAULT_STUDENT_PASSWORD,
  createAccount,
  hasAccount,
} from "./userAccounts";

interface CreateAccountDialogProps {
  students: Student[];
  onClose: () => void;
}

export default function CreateAccountDialog({
  students,
  onClose,
}: CreateAccountDialogProps) {
  const candidates = students.filter((s) => !hasAccount(s));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState(DEFAULT_STUDENT_PASSWORD);

  const handleCreate = () => {
    if (!selectedId || !password.trim()) return;
    createAccount(selectedId, password);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Student Account</DialogTitle>
          <DialogDescription>
            Pick a student who has no login yet and set their password.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every current student already has an account. Students added later
            will show up here.
          </p>
        ) : (
          <>
            <div className="max-h-56 space-y-2 overflow-auto">
              {candidates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedId === s.id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span className="text-sm font-medium">{s.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.program}
                    {s.training ? ` — ${s.training}` : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-account-password">Password</Label>
              <Input
                id="new-account-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedId || candidates.length === 0}
          >
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
