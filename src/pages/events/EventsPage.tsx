import { useState } from "react";
import { Plus } from "lucide-react";
import type { AppEvent } from "@/lib/api";
import AddEventModal from "./AddEventModal";

interface EventsPageProps {
  /**
   * When set, the modal opens pre-filled to update that event. The layout
   * clears it once the save succeeds, so returning to this page starts fresh.
   */
  initialEvent?: AppEvent | null;
  /** Called after a successful save with the stored row and whether it updated. */
  onSaved?: (saved: AppEvent, wasUpdate: boolean) => void;
  /**
   * Dismisses the creator. The layout routes back to Event History, matching
   * what a successful save does.
   */
  onClose?: () => void;
}

/**
 * The "New Event" section. The Meetup/Luma-style creator is a modal, so this
 * page is only the surface behind it: entering the section auto-opens the
 * creator, and closing it hands the admin back to Event History.
 */
export default function EventsPage({
  initialEvent,
  onSaved,
  onClose,
}: EventsPageProps) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="min-h-[50vh]">
        <h2 className="text-2xl font-semibold">Events</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a center event or publication, then manage it from{" "}
          <span className="font-medium">Events → Event History</span>.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </div>

      <AddEventModal
        open={open}
        initialEvent={initialEvent}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onSaved={(saved, wasUpdate) => {
          setOpen(false);
          onSaved?.(saved, wasUpdate);
        }}
      />
    </>
  );
}
