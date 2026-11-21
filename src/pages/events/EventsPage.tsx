import { useState } from "react";
import { History, Plus } from "lucide-react";
import { useNestedView, useViewHistory } from "@/hooks/viewHistory";
import type { AppEvent } from "@/lib/api";
import { useT } from "@/lib/i18n";
import EventsView from "./EventsView";

interface EventsPageProps {
  /**
   * When set, opens pre-filled to update that event. The layout
   * clears it once the save succeeds, so returning to this page starts fresh.
   */
  initialEvent?: AppEvent | null;
  /** Called after a successful save with the stored row and whether it updated. */
  onSaved?: (saved: AppEvent, wasUpdate: boolean) => void;
  /**
   * Dismisses the creator / navigates back to Event History or overview.
   */
  onClose?: () => void;
}

/**
 * Main Events Section.
 *
 * Renders the Meetup/Luma-style creator directly inline as a full page view
 * (`EventsView`) when creating or editing an event, with a seamless transition
 * between the overview and the creator.
 */
export default function EventsPage({
  initialEvent,
  onSaved,
  onClose,
}: EventsPageProps) {
  const [currentView, setCurrentView] = useState<"create-event" | "overview">(
    "create-event",
  );
  const [prevEvent, setPrevEvent] = useState(initialEvent);
  const { pushSection } = useViewHistory();
  const t = useT();
  // Adjust state during render if a new initialEvent is handed in
  if (initialEvent !== prevEvent) {
    setPrevEvent(initialEvent);
    if (initialEvent) {
      setCurrentView("create-event");
    }
  }

  const isCreating = currentView === "create-event";

  // Register with in-app history stack so portal top bar arrow aligns with in-page back
  useNestedView(
    isCreating,
    "create-event",
    initialEvent ? t("Edit Event") : t("Create event"),
    () => {
      setCurrentView("overview");
      onClose?.();
    },
  );

  const handleBack = () => {
    setCurrentView("overview");
    onClose?.();
  };

  if (isCreating) {
    return (
      <EventsView
        initialEvent={initialEvent}
        onBack={handleBack}
        onSaved={(saved, wasUpdate) => {
          onSaved?.(saved, wasUpdate);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{t("Events")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Create center events, workshops, hackathons, and talks, or manage published ones from Event History.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCurrentView("create-event")}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("Create event")}
        </button>
        <button
          type="button"
          onClick={() => pushSection("event-history", t("Event History"))}
          className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground"
        >
          <History className="h-4 w-4" />
          {t("View Event History")}
        </button>
      </div>
    </div>
  );
}
