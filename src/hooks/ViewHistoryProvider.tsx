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
  // `goBack` needs the live stack without being re-created on every push, so
  // the current value is mirrored into a ref.
  const entriesRef = useRef(entries);
  const nextIdRef = useRef(1);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const pushSection = useCallback((key: string, label: string) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      // A nested view belongs to the section it was opened from: switching
      // sections drops it. Its page unmounts and unregisters itself, so no
      // `close` is called here (the component is already going away).
      let trimmed = prev;
      while (
        trimmed.length > 0 &&
        trimmed[trimmed.length - 1].kind === "view"
      ) {
        trimmed = trimmed.slice(0, -1);
      }
      // Re-clicking the current section is not a navigation.
      if (trimmed[trimmed.length - 1]?.key === key) return prev;
      return [...trimmed, { id, kind: "section", key, label }];
    });
  }, []);

  const pushView = useCallback(
    (key: string, label: string, close: () => void) => {
      const id = nextIdRef.current++;
      setEntries((prev) => [...prev, { id, kind: "view", key, label, close }]);
      return id;
    },
    [],
  );

  const removeView = useCallback((id: number) => {
    setEntries((prev) =>
      prev.some((entry) => entry.id === id)
        ? prev.filter((entry) => entry.id !== id)
        : prev,
    );
  }, []);

  const goBack = useCallback(() => {
    const stack = entriesRef.current;
    const last = stack[stack.length - 1];
    if (!last) return;
    // The root section is the floor: never navigate out of the portal here.
    const sectionCount = stack.filter(
      (entry) => entry.kind === "section",
    ).length;
    if (last.kind === "section" && sectionCount <= 1) return;
    setEntries(stack.slice(0, -1));
    last.close?.();
  }, []);

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
