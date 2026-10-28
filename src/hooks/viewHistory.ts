import {
  createContext,
  useContext,
  useEffect,
  useRef,
} from "react";

// In-app back navigation for the three portals. Sections are state, not routes
// (see AGENTS.md), so the browser's history knows nothing about them: this
// stack is the history the header arrow walks.
//
// The stack always starts with the portal's root section (the dashboard). A
// section switch pushes another section entry; a nested view (course details,
// quiz, event details) pushes a view entry on top of its section. Popping a
// view entry calls its own `close`, so the arrow does exactly what the page's
// in-page Back button does.

export interface ViewHistoryEntry {
  id: number;
  kind: "section" | "view";
  key: string;
  label: string;
  /** Views only: what to do when the arrow pops this entry. */
  close?: () => void;
}

export interface ViewHistory {
  /** Where the arrow is visible: anything above the root section. */
  canGoBack: boolean;
  /** The section currently rendered by the layout's `pages` map. */
  currentSection: ViewHistoryEntry;
  goBack: () => void;
  pushSection: (key: string, label: string) => void;
  /** Registers a nested view; returns the entry id for `removeView`. */
  pushView: (key: string, label: string, close: () => void) => number;
  removeView: (id: number) => void;
}

export const ViewHistoryContext = createContext<ViewHistory | null>(null);

export function useViewHistory(): ViewHistory {
  const value = useContext(ViewHistoryContext);
  if (!value) {
    throw new Error(
      "useViewHistory must be used inside <ViewHistoryProvider> (each portal layout renders one).",
    );
  }
  return value;
}

/**
 * Registers the calling page as a nested view while `open` is true, so the
 * header arrow pops it and runs `onClose`. Unmounting removes the entry, which
 * keeps the stack honest when a page closes itself (e.g. after deleting the
 * record being shown).
 */
export function useNestedView(
  open: boolean,
  key: string,
  label: string,
  onClose: () => void,
) {
  const { pushView, removeView } = useViewHistory();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const id = pushView(key, label, () => onCloseRef.current());
    return () => removeView(id);
  }, [open, key, label, pushView, removeView]);
}
