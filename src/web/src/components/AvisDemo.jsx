/**
 * Retours d'usage écrits pour la démo.
 *
 * Pour que les écrans d'outils ne soient pas vides, l'instantané de démo
 * complète quelques retours, uniquement sur des outils réellement installés
 * et utilisés. À l'écran, rien ne les distinguait des retours consignés au
 * fil du travail : ils portent désormais une mention, pour ne jamais faire
 * passer un texte de démo pour une preuve.
 *
 * Repérés par « nom de l'outil | date du retour », tels qu'ils figurent dans
 * public/demo/state.json.
 */
import React from "react";
import { Pastille } from "./primitives.jsx";
import { DEMO } from "../lib/api.js";

const REDIGES = new Set([
  "21st.dev Magic|2026-09-28",
  "chrome-devtools-mcp|2026-11-06",
  "motion|2026-10-18",
  "obsidian-second-brain|2026-10-09",
  "playwright|2026-11-14",
  "playwright-cli|2026-11-14",
  "remotion|2026-10-12",
  "shadcn-ui-mcp-server|2026-10-03",
  "stop-slop|2026-11-02",
]);

/** Ce retour a-t-il été écrit pour la démo ? Toujours non hors démo. */
export const redigePourDemo = (nomOutil, retour) => DEMO && REDIGES.has(`${nomOutil}|${retour?.date}`);

/** Mention affichée à côté de la date d'un retour écrit pour la démo. */
export function MentionDemo({ nomOutil, retour }) {
  if (!redigePourDemo(nomOutil, retour)) return null;
  return (
    <span title="Retour écrit pour illustrer la démo, sur un outil réellement installé et utilisé">
      <Pastille ton="termine">Rédigé pour la démo</Pastille>
    </span>
  );
}
