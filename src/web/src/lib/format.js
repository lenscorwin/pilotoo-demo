/** Mise en forme partagée : dates en français, libellés d'état, tonalités. */

import { maintenant } from "./horloge.js";

const JOUR_MS = 86_400_000;

export function dateCourte(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** « il y a 3 jours », « aujourd'hui ». Plus parlant qu'une date pour l'activité. */
export function depuis(iso) {
  if (!iso) return "jamais";
  const j = Math.floor((maintenant() - new Date(iso).getTime()) / JOUR_MS);
  if (Number.isNaN(j)) return "-";
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  if (j < 31) return `il y a ${j} jours`;
  if (j < 365) return `il y a ${Math.round(j / 30)} mois`;
  return `il y a ${Math.floor(j / 365)} an${j >= 730 ? "s" : ""}`;
}

/** Nom de l'outil affiché dans l'interface (titre d'onglet, messages). */
export const NOM_OUTIL = "MyDashboard Projets";

export const LIBELLE_STATUT = {
  actif: "Actif",
  "en-pause": "En pause",
  bloque: "Bloqué",
  termine: "Terminé",
  inconnu: "Non déclaré",
};

/** Couleur d'accent par statut. Toujours doublée d'un libellé dans l'UI. */
export const TON_STATUT = {
  actif: "actif",
  "en-pause": "pause",
  bloque: "bloque",
  termine: "termine",
  inconnu: "termine",
};

export const TON_ALERTE = {
  urgent: "bloque",
  attention: "pause",
  arbitrage: "arbitrage",
  info: "termine",
};

export const LIBELLE_ETAT_OUTIL = {
  actif: "Actif",
  "installe-a-tester": "Installé, à tester",
  "a-tester": "À tester",
  "declare-seul": "Déclaré seul",
  catalogue: "Au catalogue",
  "hors-catalogue": "Hors catalogue",
};

export const TON_ETAT_OUTIL = {
  actif: "actif",
  "installe-a-tester": "pause",
  "a-tester": "pause",
  "declare-seul": "termine",
  catalogue: "termine",
  "hors-catalogue": "arbitrage",
};

export function octetsLisibles(n) {
  if (!n) return "0 o";
  const u = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

/**
 * Pastille de méthode. Le gris signale l'absence de méthode déployée : ce
 * n'est pas un défaut, juste un dossier de travail libre.
 */
export function tonMethode(m) {
  if (!m || m.nom === "aucune") return "termine";
  return m.source === "déclarée" ? "accent" : "arbitrage";
}

/** Infobulle : ce que fait la méthode, et sur quoi la détection s'appuie. */
export function titreMethode(m) {
  if (!m) return "";
  const lignes = [m.quoi];
  if (m.source === "déclarée") lignes.push("Déclarée dans etat.md (methode:)");
  else if (m.indices?.length) lignes.push(`Déduite de : ${m.indices.join(", ")}`);
  if (m.divergence) lignes.push(`Le disque ressemble plutôt à : ${m.divergence}`);
  return lignes.filter(Boolean).join(" · ");
}

/** Texte comparable pour un filtre : minuscules, sans accents, espaces réduits. */
export function normaliserRecherche(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
