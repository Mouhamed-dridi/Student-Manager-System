import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/lib/i18n";

/**
 * The logout action every portal header renders.
 *
 * Signing out ends the cookie session immediately (see `clearSession`), so the
 * button opens a confirmation first. The dialog is deliberately monochrome in
 * both themes (white / zinc-200 / zinc-900 in light, zinc-950 / zinc-800 /
 * white in dark): it should read as a deliberate interruption and never uses
 * the app's accent colours.
 */
export default function LogoutButton({
  onConfirm,
}: {
  /** Runs only after the user confirms; the caller clears and redirects. */
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("Logout")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          overlayClassName="bg-black/70 backdrop-blur-sm"
          className="max-w-[calc(100vw-2rem)] border border-zinc-200 bg-white text-zinc-900 shadow-2xl ring-0 sm:max-w-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("Sign out")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("Are you sure you want to sign out of your session?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-zinc-200 bg-transparent dark:border-zinc-800">
            <AlertDialogCancel className="border border-zinc-300 bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:border-zinc-500 focus-visible:ring-zinc-400/30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white">
              {t("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Close first so the dialog cannot linger behind the login
                // screen while the caller clears the session and redirects.
                setOpen(false);
                onConfirm();
              }}
              className="bg-zinc-900 font-medium text-white hover:bg-zinc-800 focus-visible:border-zinc-400 focus-visible:ring-zinc-500/30 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:focus-visible:border-zinc-300 dark:focus-visible:ring-white/30"
            >
              {t("Sign out")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
