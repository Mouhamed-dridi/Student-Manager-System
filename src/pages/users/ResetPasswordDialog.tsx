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

interface ResetPasswordDialogProps {
  fullName: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
}

export default function ResetPasswordDialog({
  fullName,
  onSubmit,
  onClose,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState(DEFAULT_ACCOUNT_PASSWORD);

  const handleSave = () => {
    if (!password.trim()) return;
    onSubmit(password);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {fullName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!password.trim()}>
            Save Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
