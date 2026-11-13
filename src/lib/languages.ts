// Language choices shared by the operator Settings page and the teacher /
// student Settings pages. The value is what `settings.language` stores and what
// `src/lib/i18n.ts` reads; only the languages with a full dictionary belong
// here, so a stale "ar" value from an older deployment is normalised to English
// by the settings pages.
import type { Language } from "./i18n";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];