/**
 * Retours d'usage écrits pour la démo.
 *
 * Pour que les écrans d'outils ne soient pas vides, l'instantané de démo
 * complète des retours et des avis (une note, un verdict, une phrase),
 * uniquement sur des outils réellement installés et utilisés. À l'écran, rien ne les distinguait des retours consignés au
 * fil du travail : ils portent désormais une mention, pour ne jamais faire
 * passer un texte de démo pour une preuve.
 *
 * Repérés par « outil | date | projet », tels qu'ils figurent dans
 * public/demo/state.json (fiche de l'outil et onglet « Usage & avis »).
 */
import React from "react";
import { Pastille } from "./primitives.jsx";
import { DEMO } from "../lib/api.js";

const REDIGES = new Set([
  "21st.dev Magic|2026-09-28|graphoo.fr",
  "apple-design|2026-10-15|Graphoo Atelier",
  "chrome-devtools-mcp|2026-11-06|graphoo.fr",
  "chrome-devtools-mcp|2026-11-08|MyDashboard Projets",
  "claude-in-chrome|2026-11-17|graphoo.fr",
  "claude-in-chrome|2026-11-19|Audit-Produit",
  "claude-in-chrome|2026-11-25|MyDashboard Projets",
  "github|2026-11-23|graphoo.fr",
  "graphify|2026-11-07|Audit-Produit",
  "hyperframes|2026-11-17|graphoo.fr",
  "motion|2026-10-18|graphoo.fr",
  "obsidian-second-brain|2026-10-09|Library AI",
  "playwright-cli|2026-10-15|Graphoo Atelier",
  "playwright-cli|2026-11-10|Audit-Produit",
  "playwright-cli|2026-11-14|graphoo.fr",
  "playwright-cli|2026-11-17|graphoo.fr",
  "playwright-cli|2026-11-19|MyDashboard Projets",
  "playwright|2026-10-15|Graphoo Atelier",
  "playwright|2026-11-10|Audit-Produit",
  "playwright|2026-11-14|graphoo.fr",
  "playwright|2026-11-17|graphoo.fr",
  "playwright|2026-11-19|MyDashboard Projets",
  "remotion|2026-10-12|Graphoo Atelier",
  "shadcn-ui-mcp-server|2026-10-03|Graphoo Atelier",
  "stop-slop|2026-11-02|Graphoo Atelier",
  "stop-slop|2026-11-02|graphoo.fr",
  "wcag-audit|2026-10-20|Graphoo Atelier",
  "wcag-audit|2026-11-12|graphoo.fr",
]);

/** Ce retour a-t-il été écrit pour la démo ? Toujours non hors démo. */
export const redigePourDemo = (nomOutil, retour) => DEMO && REDIGES.has(`${nomOutil}|${retour?.date}|${retour?.projet}`);

/** Mention affichée à côté de la date d'un retour écrit pour la démo. */
export function MentionDemo({ nomOutil, retour }) {
  if (!redigePourDemo(nomOutil, retour)) return null;
  return (
    <span title="Retour écrit pour illustrer la démo, sur un outil réellement installé et utilisé">
      <Pastille ton="termine">Rédigé pour la démo</Pastille>
    </span>
  );
}
