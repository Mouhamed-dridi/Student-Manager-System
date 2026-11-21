import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { generatePassword } from "./userAccounts";

interface PasswordFieldsProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * New/confirm password pair with a shared visibility toggle and a generator
 * that also copies the result, so an operator can hand the password over
 * without retyping it.
 */
export default function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  disabled,
}: PasswordFieldsProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const mismatch =
    confirmPassword.length > 0 && confirmPassword !== password;

  const handleGenerate = () => {
    const next = generatePassword();
    onPasswordChange(next);
    onConfirmChange(next);
    navigator.clipboard
      ?.writeText(next)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const toggleVisibility = () => setVisible((current) => !current);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-password">{t("New Password")}</Label>
          <div className="relative">
            <Input
              id="account-password"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="new-password"
              disabled={disabled}
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={toggleVisibility}
              disabled={disabled}
              aria-label={
                visible ? t("Hide password") : t("Show password")
              }
              className="absolute top-1/2 right-1 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {visible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-password-confirm">
            {t("Confirm Password")}
          </Label>
          <div className="relative">
            <Input
              id="account-password-confirm"
              type={visible ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => onConfirmChange(event.target.value)}
              autoComplete="new-password"
              disabled={disabled}
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={toggleVisibility}
              disabled={disabled}
              aria-label={
                visible ? t("Hide password") : t("Show password")
              }
              className="absolute top-1/2 right-1 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {visible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={disabled}
          className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          {t("Generate Password")}
        </Button>
        <span
          aria-live="polite"
          className="text-xs text-zinc-500 dark:text-zinc-400"
        >
          {copied ? t("Copied to clipboard") : t("Generated passwords are copied automatically.")}
        </span>
      </div>

      {mismatch && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("Passwords do not match.")}
        </p>
      )}
    </div>
  );
}
