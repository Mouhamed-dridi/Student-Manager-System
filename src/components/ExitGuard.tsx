// Browser-exit guard for the authenticated shells (operator / teacher / student).
//
// There is no router-level "leave" screen, so the guard works at the history
// level: on mount it pushes one sentinel entry, and every browser Back press
// lands on that entry, where `popstate` immediately re-pushes it and asks the
// user to confirm. The same component attaches `beforeunload`, so closing the
// tab or refreshing shows the browser's native prompt.
//
// Confirming "Leave" ends the cookie session (`clearSession`) and replaces the
// route with `/login`: a plain `history.back()` from the re-pushed sentinel
// would land on the in-app entry again, and on a tab opened directly there may
// be nothing to go back to.
//
// The modal is deliberately monochrome in both themes, like `LogoutButton`.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { clearSession } from "@/lib/session";

/**
 * Push the sentinel entry, preserving the router's own history state
 * (`usr`, `key`, `idx`) so React Router keeps resolving locations correctly.
 */
function pushGuardEntry() {
  const current = window.history.state as Record<string, unknown> | null;
  if (current?.appGuard) return;
  const next: Record<string, unknown> = { ...(current ?? {}), appGuard: true };
  if (typeof current?.idx === "number") next.idx = current.idx + 1;
  window.history.pushState(next, "", window.location.href);
}

export default function ExitGuard() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Set while confirming so the listeners stop reacting before the redirect.
  const leavingRef = useRef(false);

  useEffect(() => {
    pushGuardEntry();

    const onPopState = () => {
      if (leavingRef.current) return;
      // Stay inside the app: put the sentinel back, then ask.
      pushGuardEntry();
      setOpen(true);
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      // Legacy browsers need a truthy `returnValue` to show the prompt.
      event.returnValue = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const handleLeave = useCallback(() => {
    leavingRef.current = true;
    setOpen(false);
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent
        overlayClassName="bg-black/70 backdrop-blur-sm"
        className="max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl ring-0 sm:max-w-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <AlertDialogHeader className="gap-2 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-center sm:group-data-[size=default]/alert-dialog-content:text-center">
          <AlertDialogTitle className="text-base font-semibold text-zinc-900 dark:text-white">
            {t("Leave the application?")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("Are you sure you want to leave the Student Manager System?")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2 border-t-0 bg-transparent p-0 sm:justify-center">
          <AlertDialogCancel className="border border-zinc-300 bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:border-zinc-500 focus-visible:ring-zinc-400/30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white">
            {t("Stay")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            className="bg-zinc-900 font-medium text-white hover:bg-zinc-800 focus-visible:border-zinc-400 focus-visible:ring-zinc-500/30 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:focus-visible:border-zinc-300 dark:focus-visible:ring-white/30"
          >
            {t("Leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
