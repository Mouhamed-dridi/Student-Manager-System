import { useEffect, useRef } from "react";

// Quiet fallback for real-time pages: if the browser tab regains focus after
// being in the background for a while (e.g. the realtime socket silently
// dropped while hidden), re-fetch the page's data once. This is NOT the
// primary sync mechanism - that's the realtime subscription - so it only
// fires after a meaningful background period and never while visible.
const BACKGROUND_THRESHOLD_MS = 5000;

function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useRefetchOnFocus(refetch: () => void | Promise<void>): void {
  const refetchRef = useLatest(refetch);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenFor = Date.now() - (hiddenAtRef.current ?? Date.now());
      hiddenAtRef.current = null;
      if (hiddenFor >= BACKGROUND_THRESHOLD_MS) {
        void refetchRef.current();
      }
    };

    const onFocus = () => {
      // Window focus alone (e.g. switching apps without tab changes) counts
      // as a regain of attention; respect the same background threshold.
      onVisibility();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchRef, hiddenAtRef]);
}
