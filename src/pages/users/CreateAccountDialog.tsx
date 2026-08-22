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
import { DEFAULT_ACCOUNT_PASSWORD } from "./userAccounts";

export interface AccountCandidate {
  id: string;
  fullName: string;
  detail?: string;
}

interface CreateAccountDialogProps {
  entityLabel: "student" | "teacher";
  candidates: AccountCandidate[];
  onSubmit: (id: string, password: string) => void;
  onClose: () => void;
}

export default function CreateAccountDialog({
  entityLabel,
  candidates,
  onSubmit,
  onClose,
}: CreateAccountDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState(DEFAULT_ACCOUNT_PASSWORD);

  const handleCreate = () => {
    if (!selectedId || !password.trim()) return;
    onSubmit(selectedId, password);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {entityLabel} account</DialogTitle>
          <DialogDescription>
            Pick a {entityLabel} who has no login yet and set their password.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every current {entityLabel} already has an account. Records added
            later will show up here.
          </p>
        ) : (
          <>
            <div className="max-h-56 space-y-2 overflow-auto">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedId === c.id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span className="text-sm font-medium">{c.fullName}</span>
                  {c.detail && (
                    <span className="text-xs text-muted-foreground">
                      {c.detail}
                    </span>
                  )}
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
