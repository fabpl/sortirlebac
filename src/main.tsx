import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";

import { Application } from "./Application.js";
import "./styles.css";

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <Application />
    <Analytics />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Hors-ligne indisponible : l'application reste utilisable en ligne.
    });
  });
}
