import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Font Awesome ships its base stylesheet as a file; importing it up front (and
// turning off the runtime <style> injection) avoids a frame of oversized icons
// on the profiles. It must come before index.css so Tailwind can still win.
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./index.css";
import App from "./App.tsx";
import { applyDarkMode, getCachedSettings, getSettings } from "@/lib/api";
import { setBrandingFromSettings } from "@/lib/branding";
import { setLanguage, syncLanguageFromSettings } from "@/lib/i18n";

config.autoAddCss = false;

applyDarkMode(getCachedSettings().darkMode === true);
setLanguage(getCachedSettings().language === "fr" ? "fr" : "en");
getSettings()
  .then((settings) => {
    applyDarkMode(settings.darkMode === true);
    syncLanguageFromSettings(settings.language);
    setBrandingFromSettings(settings);
  })
  .catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
