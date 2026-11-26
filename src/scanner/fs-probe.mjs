/**
 * Couche « constaté » : tout ce que le disque dit d'un projet sans qu'on ait
 * eu à lire son contenu. Zéro token, zéro interprétation.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { lireHistorique } from "./git-graphe.mjs";

/** Dossiers traversés pour rien : sorties de build, caches, graphe auto-généré. */
const IGNORES = new Set([
  "node_modules", ".git", "graphify-out", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", ".obsidian", ".cache", ".DS_Store",
]);

const EXT_DOC = new Set([".md", ".txt", ".pdf", ".docx", ".doc", ".odt", ".rtf"]);

/**
 * Parcours borné en profondeur : compte les fichiers, retient le plus
 * récemment modifié. La borne évite qu'un projet contenant une arborescence
 * pathologique fasse traîner le scan du matin.
 *
 * `exclus` : dossiers absolus à ne pas traverser, ceux d'un projet suivi à
 * part entière qui vit dans celui-ci (graphoo-v2 dans graphoo). Sans cela,
 * chaque modification du site ferait aussi bouger la racine.
 */
export function sonderDossier(racine, profondeurMax = 6, exclus = []) {
  const sauter = new Set(exclus.map((x) => path.resolve(x)));
  const stats = {
    nbFichiers: 0,
    nbDocuments: 0,
    octets: 0,
    derniereModif: null,
    dernierFichier: null,
  };

  const descendre = (dossier, profondeur) => {
    if (profondeur > profondeurMax) return;
    let entrees;
    try {
      entrees = fs.readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      if (IGNORES.has(e.name) || e.name.startsWith("._")) continue;
      const complet = path.join(dossier, e.name);

      if (e.isDirectory()) {
        if (!sauter.has(complet)) descendre(complet, profondeur + 1);
        continue;
      }
      if (!e.isFile()) continue;

      let st;
      try {
        st = fs.statSync(complet);
      } catch {
        continue;
      }
      stats.nbFichiers += 1;
      stats.octets += st.size;
      if (EXT_DOC.has(path.extname(e.name).toLowerCase())) stats.nbDocuments += 1;

      const mtime = st.mtime.toISOString();
      if (!stats.derniereModif || mtime > stats.derniereModif) {
        stats.derniereModif = mtime;
        stats.dernierFichier = path.relative(racine, complet).split(path.sep).join("/");
      }
    }
  };

  descendre(racine, 0);
  return stats;
}

/** Lanceur de commandes git en lecture dans un dossier ; "" en cas d'échec. */
function gitDans(dossier) {
  return (...args) => {
    try {
      return execFileSync("git", ["-C", dossier, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
      }).trim();
    } catch {
      return "";
    }
  };
}

/**
 * Copies de travail (`git worktree`) du dépôt, hors le dossier du projet.
 * Agentastic en crée une par tâche : ce qui s'y fait n'est pas encore dans le
 * projet, on le montre à part au lieu de le mêler à l'état déclaré.
 */
function lireCopies(git, racine) {
  const blocs = git("worktree", "list", "--porcelain").split("\n\n").filter(Boolean);
  const copies = [];
  for (const bloc of blocs) {
    const champs = Object.fromEntries(
      bloc.split("\n").map((l) => {
        const i = l.indexOf(" ");
        return i < 0 ? [l, true] : [l.slice(0, i), l.slice(i + 1)];
      }),
    );
    const chemin = champs.worktree;
    if (!chemin || path.resolve(chemin) === path.resolve(racine)) continue;
    if (champs.prunable || champs.bare || !fs.existsSync(chemin)) continue;
    const sale = gitDans(chemin)("status", "--porcelain");
    const sha = champs.HEAD;
    copies.push({
      nom: path.basename(chemin),
      chemin,
      branche: typeof champs.branch === "string" ? champs.branch.replace(/^refs\/heads\//, "") : null,
      // Commits de la copie absents de la branche ouverte dans le projet.
      aFusionner: sha ? Number(git("rev-list", "--count", `HEAD..${sha}`)) || 0 : 0,
      fichiersModifies: sale ? sale.split("\n").filter(Boolean).length : 0,
      dernierCommit: (sha && git("log", "-1", "--format=%cI", sha)) || null,
    });
  }
  return copies;
}

/** État git, ou null si le projet n'est pas un dépôt. */
export function sonderGit(racine) {
  if (!fs.existsSync(path.join(racine, ".git"))) return null;
  const git = gitDans(racine);

  const dernier = git("log", "-1", "--format=%cI\u0001%s\u0001%an");
  const [dateISO, sujet] = dernier ? dernier.split("\u0001") : ["", ""];
  const sale = git("status", "--porcelain");

  return {
    branche: git("rev-parse", "--abbrev-ref", "HEAD") || null,
    dernierCommit: dateISO || null,
    dernierMessage: sujet || null,
    fichiersModifies: sale ? sale.split("\n").filter(Boolean).length : 0,
    historique: lireHistorique(git),
    copies: lireCopies(git, racine),
  };
}

/** Premier chemin existant parmi les candidats, relatif à la racine. */
export function premierExistant(racine, candidats) {
  for (const c of candidats) {
    const complet = path.join(racine, c);
    if (fs.existsSync(complet)) return { relatif: c, absolu: complet };
  }
  return null;
}

/** Nombre de jours entiers écoulés depuis une date ISO. */
export function joursDepuis(iso) {
  if (!iso) return null;
  const delta = Date.now() - new Date(iso).getTime();
  return Math.floor(delta / 86_400_000);
}
