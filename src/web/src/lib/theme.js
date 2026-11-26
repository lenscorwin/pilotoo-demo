/**
 * Thème de nuit à heure fixe : de 22 h à 8 h, Pilotoo passe en sombre.
 *
 * L'heure du Mac seulement, pas le réglage d'apparence de macOS : en mode
 * « Automatique », macOS bascule au coucher du soleil, vers 17 h 30 l'hiver.
 * Vérifié chaque minute et au retour sur l'onglet, pour un onglet ouvert
 * toute la soirée.
 *
 * La pastille du menu force l'autre thème jusqu'à la prochaine bascule
 * (22 h ou 8 h), puis l'horaire reprend la main. Le forçage est gardé dans
 * le navigateur pour survivre à un rechargement.
 *
 * Pour regarder un thème sans toucher au forçage : `?theme=nuit` ou
 * `?theme=jour` dans l'adresse (rien n'est gardé).
 */
import { useSyncExternalStore } from "react";

export const DEBUT_NUIT = 22;
export const FIN_NUIT = 8;
const CLE = "pilotoo.theme";

export const estLaNuit = (d = new Date()) => {
  const h = d.getHours();
  return h >= DEBUT_NUIT || h < FIN_NUIT;
};

/** L'heure de la prochaine bascule automatique, 22 h ou 8 h. */
function prochaineBascule(d = new Date()) {
  const b = new Date(d);
  b.setMinutes(0, 0, 0);
  if (estLaNuit(d)) {
    if (d.getHours() >= DEBUT_NUIT) b.setDate(b.getDate() + 1);
    b.setHours(FIN_NUIT);
  } else {
    b.setHours(DEBUT_NUIT);
  }
  return b.getTime();
}

const parAdresse = () => {
  const t = new URLSearchParams(window.location.search).get("theme");
  return t === "nuit" || t === "jour" ? t : null;
};

/** Le forçage de la pastille, s'il court encore. */
function lireForce() {
  try {
    const f = JSON.parse(localStorage.getItem(CLE));
    if (f && (f.theme === "nuit" || f.theme === "jour") && Date.now() < f.jusqua) return f.theme;
    localStorage.removeItem(CLE);
  } catch {
    // Stockage indisponible : l'horaire seul décide.
  }
  return null;
}

const calculer = () => parAdresse() ?? lireForce() ?? (estLaNuit() ? "nuit" : "jour");

let theme = null;
const abonnes = new Set();
let fondu = null;

function appliquer(premiere = false) {
  const t = calculer();
  if (t === theme) return;
  const racine = document.documentElement;
  // Fondu seulement à la bascule, pas à l'ouverture de la page.
  if (!premiere) {
    racine.classList.add("bascule-theme");
    clearTimeout(fondu);
    fondu = setTimeout(() => racine.classList.remove("bascule-theme"), 800);
  }
  theme = t;
  racine.dataset.theme = t;
  abonnes.forEach((f) => f());
}

export function suivreTheme() {
  appliquer(true);
  setInterval(() => appliquer(), 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) appliquer();
  });
}

/** La pastille : passe à l'autre thème jusqu'à la prochaine bascule, ou revient à l'horaire. */
export function basculerTheme() {
  const voulu = theme === "nuit" ? "jour" : "nuit";
  const horaire = estLaNuit() ? "nuit" : "jour";
  try {
    if (voulu === horaire) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, JSON.stringify({ theme: voulu, jusqua: prochaineBascule() }));
  } catch {
    // Sans stockage, le forçage tient jusqu'à la prochaine vérification.
  }
  appliquer();
  if (theme !== voulu) {
    // Stockage refusé : on applique quand même pour cette minute.
    theme = voulu;
    document.documentElement.dataset.theme = voulu;
    abonnes.forEach((f) => f());
  }
}

export function useTheme() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => theme
  );
}
