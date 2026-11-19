// News Center: the full-width home of the "Published announcements" feed
// (search, type filters, edit/delete). The feed used to sit beside the
// composer on the Publications page; composing now lives there alone.

import { useI18n } from "@/lib/i18n";
import PublicationsFeed from "@/pages/publications/PublicationsFeed";

export default function NewsCenterPage() {
  const { t } = useI18n();

  return (
    <div>
      <h2 className="text-2xl font-semibold">{t("News Center")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Every published announcement, newest first.")}
      </p>

      <div className="mt-6">
        <PublicationsFeed />
      </div>
    </div>
  );
}
