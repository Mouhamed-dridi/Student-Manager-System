// High-contrast room chip ("B11") shown next to the session time in every
// planning view: the teacher page, the student schedule and the operator
// Planification grid. Kept in one place so the four render sites cannot drift.
export function PlanningRoomBadge({ room }: { room: string }) {
  return (
    <span
      title={`Room ${room}`}
      className="inline-flex shrink-0 items-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background"
    >
      {room}
    </span>
  );
}
