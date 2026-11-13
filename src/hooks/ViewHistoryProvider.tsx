import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ViewHistoryContext,
  type ViewHistory,
  type ViewHistoryEntry,
} from "@/hooks/viewHistory";

/**
 * Marks the synthetic history entry used to intercept the browser Back button.
 * The value never reaches the URL (the entry keeps the current path), so React
 * Router sees no route change.
 */
const GUARD_STATE_KEY = "ssmViewGuard";

/**
 * In-app view history + browser Back interception.
 *
 * Sections are state, not routes (`/dashboard`, `/student`, `/teacher` are the
 * only portal URLs, see AGENTS.md), so the browser knows nothing about them.
 * Without help, pressing Back while a nested view is open (a branch detail, a
 * course page, a quiz…) leaves the portal instead of returning to the list it
 * was opened from.
 *
 * While the stack is deeper than its root section the provider keeps exactly
 * ONE synthetic entry ahead of the real URL. A Back press then consumes that
 * entry, the `popstate` below is converted into the same `goBack()` the header
 * arrow calls, and a fresh guard is armed if the stack is still deeper than the
 * root. When the stack is back at its root no guard is kept, so Back keeps its
 * normal meaning (leaving the portal) once the user is home.
 */
export default function ViewHistoryProvider({
  root,
  children,
}: {
  /** The portal's primary page, e.g. `{ key: "dashboard", label: "Dashboard" }`. */
  root: { key: string; label: string };
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<ViewHistoryEntry[]>(() => [
    { id: 0, kind: "section", key: root.key, label: root.label },
  ]);
  // `entries` mirrored synchronously: a popstate handler and a rapid second
  // click must see the stack they just changed, not the previous render's.
  const entriesRef = useRef(entries);
  const nextIdRef = useRef(1);
  // True while the synthetic entry sits ahead of the current URL.
  const guardRef = useRef(false);
  // Number of `history.back()` calls this provider started itself; their
  // `popstate` is not a user gesture and must not pop the in-app stack.
  const ownBackRef = useRef(0);

  /** Writes the stack once, to React state and to the synchronous mirror. */
  const commit = useCallback((next: ViewHistoryEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const pushSection = useCallback(
    (key: string, label: string) => {
      // A nested view belongs to the section it was opened from: switching
      // sections drops it. Its page unmounts and unregisters itself, so no
      // `close` is called here (the component is already going away).
      let trimmed = entriesRef.current;
      while (
        trimmed.length > 0 &&
        trimmed[trimmed.length - 1].kind === "view"
      ) {
        trimmed = trimmed.slice(0, -1);
      }
      // Re-clicking the current section is not a navigation.
      if (trimmed[trimmed.length - 1]?.key === key) return;
      commit([
        ...trimmed,
        { id: nextIdRef.current++, kind: "section", key, label },
      ]);
    },
    [commit],
  );

  const pushView = useCallback(
    (key: string, label: string, close: () => void) => {
      const id = nextIdRef.current++;
      commit([...entriesRef.current, { id, kind: "view", key, label, close }]);
      return id;
    },
    [commit],
  );

  const removeView = useCallback(
    (id: number) => {
      const stack = entriesRef.current;
      if (!stack.some((entry) => entry.id === id)) return;
      commit(stack.filter((entry) => entry.id !== id));
    },
    [commit],
  );

  const goBack = useCallback(() => {
    const stack = entriesRef.current;
    const last = stack[stack.length - 1];
    if (!last) return;
    // The root section is the floor: never navigate out of the portal here.
    const sectionCount = stack.filter(
      (entry) => entry.kind === "section",
    ).length;
    if (last.kind === "section" && sectionCount <= 1) return;
    commit(stack.slice(0, -1));
    last.close?.();
  }, [commit]);

  /** Pushes the synthetic entry that absorbs one browser Back press. */
  const armGuard = useCallback(() => {
    if (guardRef.current) return;
    // Keep React Router's own history state (`idx`, `key`, `usr`) intact so a
    // later router navigation still computes its delta correctly.
    const current = window.history.state;
    window.history.pushState(
      {
        ...(current && typeof current === "object" ? current : {}),
        [GUARD_STATE_KEY]: true,
      },
      "",
    );
    guardRef.current = true;
  }, []);

  /**
   * Removes the synthetic entry again (`history.back()`), ignoring the
   * `popstate` it causes. Used when the stack returns to its root through the
   * in-app arrow or a page's own Back button, so those actions do not leave a
   * dead Back press behind.
   */
  const disarmGuard = useCallback(() => {
    if (!guardRef.current) return;
    guardRef.current = false;
    ownBackRef.current += 1;
    window.history.back();
  }, []);

  // The guard follows the stack depth: one entry ahead while a view is open,
  // none at the root section.
  useEffect(() => {
    if (entries.length > 1) armGuard();
    else disarmGuard();
  }, [entries.length, armGuard, disarmGuard]);

  // Browser Back inside the portal is the same action as the header arrow.
  useEffect(() => {
    const onPopState = () => {
      // Our own `history.back()` (dropping the guard) already happened inside
      // the app: nothing to undo.
      if (ownBackRef.current > 0) {
        ownBackRef.current -= 1;
        return;
      }
      // A user Back press consumed the synthetic entry.
      guardRef.current = false;
      // Root section: no in-app view to close, so Back keeps its normal
      // meaning (React Router handles the route change, if any).
      if (entriesRef.current.length <= 1) return;
      goBack();
      // Still inside a nested view → re-arm immediately (the entries effect
      // would do it after the render, but a fast second press must not escape).
      if (entriesRef.current.length > 1) armGuard();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [goBack, armGuard]);

  const currentSection = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].kind === "section") return entries[i];
    }
    return entries[0];
  }, [entries]);

  const value = useMemo<ViewHistory>(
    () => ({
      canGoBack: entries.length > 1,
      currentSection,
      goBack,
      pushSection,
      pushView,
      removeView,
    }),
    [
      entries.length,
      currentSection,
      goBack,
      pushSection,
      pushView,
      removeView,
    ],
  );

  return (
    <ViewHistoryContext.Provider value={value}>
      {children}
    </ViewHistoryContext.Provider>
  );
}
