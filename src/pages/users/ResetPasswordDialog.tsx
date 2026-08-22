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
import { DEFAULT_STUDENT_PASSWORD, resetPassword } from "./userAccounts";

interface ResetPasswordDialogProps {
  student: Student;
  onClose: () => void;
}

export default function ResetPasswordDialog({
  student,
  onClose,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState(DEFAULT_STUDENT_PASSWORD);

  const handleSave = () => {
    if (!password.trim()) return;
    resetPassword(student.id, password);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {student.fullName}.
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
