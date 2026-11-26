import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Polices servies avec le site : aucune requête vers un serveur tiers à
// l'ouverture, et la page garde sa typographie hors ligne.
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "./index.css";
import { suivreTheme } from "./lib/theme.js";

// Avant le premier rendu : la page s'ouvre directement dans le bon thème.
suivreTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
