/**
 * Accès aux données. Le front ne lit jamais le disque directement.
 *
 * Deux régimes, choisis à la compilation :
 * - outil réel : le serveur local répond sur `/api/*` ;
 * - démo (`vite build --mode demo`) : aucun serveur. L'état est un instantané
 *   figé (`demo/state.json`), le scan est joué, l'ouverture d'un fichier
 *   est confiée aux fenêtres simulées par un événement `pilotoo:ouvrir`.
 */

import { figerAujourdhui, maintenant } from "./horloge.js";

export const DEMO = import.meta.env.MODE === "demo";

/** Chemin relatif à la page : la démo marche sur un sous-domaine comme dans un sous-dossier. */
const demo = (fichier) => `${import.meta.env.BASE_URL}demo/${fichier}`;

/** Durée du scan joué : assez pour voir l'animation, pas assez pour lasser. */
const DUREE_SCAN_DEMO = 1600;

/** Le visiteur a-t-il déjà cliqué « Marquer comme vu » ? Même clé que DepuisVisite.jsx. */
function dejaVu() {
  try {
    return Boolean(localStorage.getItem("pilotoo.derniereVisite"));
  } catch {
    return false;
  }
}

/** Date du dernier scan joué : la démo affiche « mis à jour à l'instant » après un clic. */
let scanJoueLe = null;

export async function chargerEtat() {
  if (DEMO) {
    const r = await fetch(demo("state.json"));
    if (!r.ok) throw new Error(`Instantané de démonstration introuvable (${r.status})`);
    const etat = await r.json();
    // `instantane` garde la vraie date de l'instantané pour le bandeau.
    etat.instantane ??= etat.genereLe;
    // La démo vit à la date de son instantané, pas à celle du visiteur.
    figerAujourdhui(etat.instantane);
    if (scanJoueLe) etat.genereLe = scanJoueLe;
    return etat;
  }
  const r = await fetch("/api/state");
  if (!r.ok) throw new Error(`Serveur injoignable (${r.status})`);
  return r.json();
}

/** Relance le scan. Gratuit : aucun appel de modèle côté serveur. En démo, il est joué. */
export async function relancerScan() {
  if (DEMO) {
    await new Promise((fin) => setTimeout(fin, DUREE_SCAN_DEMO));
    scanJoueLe = new Date(maintenant()).toISOString();
    return { ok: true, joue: true };
  }
  const r = await fetch("/api/rescan", { method: "POST" });
  if (!r.ok) throw new Error("Le scan a échoué");
  return r.json();
}

/**
 * Ouvre une URI dans l'application native (Obsidian, Finder).
 * En démo, rien ne sort du navigateur : un événement est émis, et les
 * fenêtres simulées l'interceptent.
 */
export async function ouvrir(uri) {
  if (!uri) return;
  if (DEMO) {
    window.dispatchEvent(new CustomEvent("pilotoo:ouvrir", { detail: { uri } }));
    return;
  }
  await fetch("/api/ouvrir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }),
  });
}

/**
 * Ce qui a bougé depuis une date : étapes bouclées, arbitrages tranchés, jalons.
 * En démo, le bilan est figé : chaque visiteur voit les mêmes nouveautés,
 * pour que la fonction se montre dès la première visite.
 */
export async function chargerProgres(depuis) {
  if (DEMO) {
    const vide = { depuis: null, projets: [], total: { closes: 0, tranches: 0, sessions: 0, jalons: 0 } };
    // « Marquer comme vu » écrit cette clé (DepuisVisite.jsx) : le visiteur a
    // vu les nouveautés, le bilan se vide comme dans l'outil réel.
    if (dejaVu()) return vide;
    const r = await fetch(demo("progres.json"));
    return r.ok ? r.json() : vide;
  }
  const r = await fetch(`/api/progres?depuis=${encodeURIComponent(depuis)}`);
  if (!r.ok) throw new Error("Historique illisible");
  return r.json();
}
