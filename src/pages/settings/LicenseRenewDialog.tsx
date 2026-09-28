import { useState, type KeyboardEvent } from "react";
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
import { APP_SHORT_NAME } from "@/lib/appInfo";
import { LICENSE_TERM_MONTHS } from "@/lib/license";

interface LicenseRenewDialogProps {
  /** True while the page persists the new term; keeps the dialog open on error. */
  submitting: boolean;
  onSubmit: (token: string) => void;
  onClose: () => void;
}

export default function LicenseRenewDialog({
  submitting,
  onSubmit,
  onClose,
}: LicenseRenewDialogProps) {
  const [token, setToken] = useState("");
  const isBlank = token.trim().length === 0;

  // Enter submits from the input, matching the single-field form behaviour of
  // the other dialogs in the app.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || isBlank || submitting) return;
    e.preventDefault();
    onSubmit(token.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter License Token</DialogTitle>
          <DialogDescription>
            Paste the token issued by the {APP_SHORT_NAME} team to activate a
            new {LICENSE_TERM_MONTHS}-month term.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="license-token">License Token</Label>
          <Input
            id="license-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste your license token here..."
            autoFocus
            spellCheck={false}
            autoComplete="off"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            The token is validated by the issuing server; renewing restarts the
            term from today.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(token.trim())}
            disabled={isBlank || submitting}
            className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600/50 dark:hover:bg-green-500"
          >
            {submitting ? "Activating…" : "Activate License"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
