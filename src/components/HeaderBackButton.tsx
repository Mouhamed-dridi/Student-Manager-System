import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewHistory } from "@/hooks/viewHistory";
import { useT } from "@/lib/i18n";

/**
 * The header's back arrow. It renders only when the in-app history has
 * somewhere to go, so the root dashboard of every portal is clean.
 */
export default function HeaderBackButton() {
  const { canGoBack, goBack } = useViewHistory();
  const t = useT();

  if (!canGoBack) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("Go back")}
      title={t("Go back")}
      onClick={goBack}
    >
      <ArrowLeft />
    </Button>
  );
}
