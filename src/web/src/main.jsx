import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { suivreTheme } from "./lib/theme.js";

// Avant le premier rendu : la page s'ouvre directement dans le bon thème.
suivreTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
