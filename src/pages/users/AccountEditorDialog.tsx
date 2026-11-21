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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import type { AccountKind, AccountRole } from "./userAccounts";
import { ROLE_LABEL_KEYS, rolesForKind } from "./userAccounts";
import PasswordFields from "./PasswordFields";

interface AccountEditorDialogProps {
  kind: AccountKind;
  fullName: string;
  email: string;
  role: AccountRole;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Account editor for an existing login. Identity comes straight from the
 * people table and is read-only; only the role (real choices exist for the
 * operator space) and the password are editable.
 */
export default function AccountEditorDialog({
  kind,
  fullName,
  email,
  role,
  onSubmit,
  onClose,
}: AccountEditorDialogProps) {
  const t = useT();
  const roleOptions = rolesForKind(kind);
  const roleLocked = roleOptions.length < 2;
  const items = roleOptions.map((option) => ({
    value: option,
    label: t(ROLE_LABEL_KEYS[option]),
  }));

  const [selectedRole, setSelectedRole] = useState<AccountRole>(role);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    password.trim().length > 0 && password === confirmPassword && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Edit account")}</DialogTitle>
          <DialogDescription>
            {t("Only the role and password can be edited.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t("Account identity")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("Full Name")}
                </p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {fullName || "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("Email / Username")}
                </p>
                <p className="text-sm font-medium break-all text-zinc-900 dark:text-zinc-100">
                  {email || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-role">{t("Role")}</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setSelectedRole((value as AccountRole | null) ?? role)
              }
              items={items}
              disabled={roleLocked || saving}
            >
              <SelectTrigger id="account-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleLocked && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("Roles are fixed by the record type and cannot be changed here.")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("Password")}</Label>
            <PasswordFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
              disabled={saving}
            />
          </div>

          {error && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? t("Saving…") : t("Save Password")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
