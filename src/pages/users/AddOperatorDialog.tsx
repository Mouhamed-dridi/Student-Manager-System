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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import type { AccountRole } from "./userAccounts";
import { OPERATOR_ROLES, ROLE_LABEL_KEYS } from "./userAccounts";
import PasswordFields from "./PasswordFields";

interface AddOperatorDialogProps {
  onClose: () => void;
}

/**
 * Operator creation form. There is no operators/admins table in the database
 * yet, so the form collects everything it will need and leaves the save action
 * disabled until that table (and its API wiring) exists.
 */
export default function AddOperatorDialog({ onClose }: AddOperatorDialogProps) {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("operator");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const items = OPERATOR_ROLES.map((option) => ({
    value: option,
    label: t(ROLE_LABEL_KEYS[option]),
  }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Add Operator")}</DialogTitle>
          <DialogDescription>
            {t("Create an administrator or operator account.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operator-name">{t("Full Name")}</Label>
              <Input
                id="operator-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operator-email">{t("Email / Username")}</Label>
              <Input
                id="operator-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-role">{t("Role")}</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole((value as AccountRole | null) ?? "operator")
              }
              items={items}
            >
              <SelectTrigger id="operator-role" className="w-full">
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
          </div>

          <div className="space-y-2">
            <Label>{t("Password")}</Label>
            <PasswordFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
            />
          </div>

          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            {t("Operator accounts are not stored yet. This form is ready for database wiring.")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled>{t("Add Operator")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
