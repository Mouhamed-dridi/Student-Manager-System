// The "Personalize your dashboard" trigger shared by all three dashboards.
// It sits exactly where the old static subtitle used to be, so the affordance
// is in the same place in every portal.

import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PersonalizeDashboardButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <Settings2 className="h-4 w-4" />
      Personalize your dashboard
    </button>
  );
}
