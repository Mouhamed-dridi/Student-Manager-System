// The "Personalize your dashboard" trigger shared by all three dashboards.
// It sits exactly where the old static subtitle used to be, so the affordance
// is in the same place in every portal.

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function PersonalizeDashboardButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("mt-2", className)}
    >
      <Settings2 className="h-4 w-4" />
      {t("Personalize your dashboard")}
    </Button>
  );
}
