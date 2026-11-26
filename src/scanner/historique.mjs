/**
 * Historique des scans : de quoi dire « ce qui a bougé depuis ma dernière
 * visite » sans rien écrire dans les projets.
 *
 * Chaque scan ajoute un instantané à `data/historique.json`, mais seulement
 * si un projet a changé depuis le précédent : dix scans dans la journée sans
 * rien toucher ne font qu'une entrée. Un instantané ne garde que ce que la
 * comparaison utilise : des listes de textes, pas l'état complet.
 */
import fs from "node:fs";
import path from "node:path";

const MAX_INSTANTANES = 300;
const PALIERS = [25, 50, 75, 100];

/** Ce qu'on retient d'un projet pour pouvoir le comparer plus tard. */
function instantaneProjet(p) {
  return {
    id: p.id,
    nom: p.nom,
    statut: p.statut,
    ouvertes: (p.etapes ?? []).map((e) => e.texte),
    closes: (p.etapesCloses ?? []).map((e) => e.texte),
    arbitrages: (p.arbitrages ?? []).map((a) => a.texte),
    sessions: (p.sessions ?? []).map((s) => `${s.date ?? ""} · ${s.texte}`),
    pourcentage: p.progression?.pourcentage ?? null,
  };
}

export function lireHistorique(fichier) {
  try {
    return JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch {
    return [];
  }
}

/** Ajoute l'instantané du scan si quelque chose a changé. */
export function consignerScan(fichier, projets, date) {
  const historique = lireHistorique(fichier);
  const projetsInst = projets.filter((p) => p.instrumente).map(instantaneProjet);
  const dernier = historique.at(-1);
  if (dernier && JSON.stringify(dernier.projets) === JSON.stringify(projetsInst)) return;

  historique.push({ date, projets: projetsInst });
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify(historique.slice(-MAX_INSTANTANES)), "utf8");
}

/**
 * Ce qui a bougé entre l'instantané en vigueur à `depuis` et le dernier.
 * Sans instantané assez ancien, on part du plus ancien connu : mieux vaut
 * un bilan un peu court qu'un bilan vide.
 */
export function progresDepuis(historique, depuis) {
  if (!historique.length) return { depuis: null, projets: [], total: totalVide() };

  const borne = new Date(depuis).getTime();
  const avant = [...historique].reverse().find((i) => new Date(i.date).getTime() <= borne) ?? historique[0];
  const apres = historique.at(-1);
  const anciens = new Map(avant.projets.map((p) => [p.id, p]));

  const projets = [];
  for (const p of apres.projets) {
    const a = anciens.get(p.id);
    if (!a) continue; // projet apparu entre-temps : rien à comparer
    const d = comparer(a, p);
    if (d) projets.push(d);
  }

  const total = totalVide();
  for (const d of projets) {
    total.closes += d.closes.length;
    total.tranches += d.tranches.length;
    total.sessions += d.sessions.length;
    total.jalons += d.jalons.length;
  }
  return { depuis: avant.date, jusqua: apres.date, projets, total };
}

function totalVide() {
  return { closes: 0, tranches: 0, sessions: 0, jalons: 0 };
}

function comparer(a, p) {
  const closesAvant = new Set(a.closes);
  const arbitragesApres = new Set(p.arbitrages);
  const sessionsAvant = new Set(a.sessions);

  const closes = p.closes.filter((t) => !closesAvant.has(t));
  const tranches = a.arbitrages.filter((t) => !arbitragesApres.has(t));
  const sessions = p.sessions.filter((s) => !sessionsAvant.has(s));

  const jalons = [];
  if (a.pourcentage != null && p.pourcentage != null) {
    for (const palier of PALIERS) {
      if (a.pourcentage < palier && p.pourcentage >= palier) jalons.push({ type: "palier", valeur: palier });
    }
  }
  if (a.arbitrages.length > 0 && p.arbitrages.length === 0) jalons.push({ type: "arbitrages-vides" });
  if (a.statut !== "termine" && p.statut === "termine") jalons.push({ type: "termine" });

  if (!closes.length && !tranches.length && !sessions.length && !jalons.length) return null;
  return { id: p.id, nom: p.nom, closes, tranches, sessions, jalons, pourcentage: p.pourcentage };
}
