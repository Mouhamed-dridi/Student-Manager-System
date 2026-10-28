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

config.autoAddCss = false;

applyDarkMode(getCachedSettings().darkMode === true);
getSettings()
  .then((settings) => {
    applyDarkMode(settings.darkMode === true);
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
