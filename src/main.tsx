import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { applyDarkMode, getCachedSettings, getSettings } from "@/lib/api";

applyDarkMode(getCachedSettings().darkMode === true);
getSettings()
  .then((settings) => applyDarkMode(settings.darkMode === true))
  .catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
