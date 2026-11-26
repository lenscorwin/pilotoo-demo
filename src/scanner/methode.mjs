/**
 * Quelle méthode de travail est appliquée sur un projet.
 *
 * Les cinq méthodes de la base « Skills-Lib » laissent chacune
 * une signature de fichiers distincte, parce qu'elles se déploient en copiant
 * un starter. On la lit donc sur le disque, sans rien deviner.
 *
 * Comme partout dans ce projet, le déclaré l'emporte sur le constaté : un
 * `methode:` écrit dans le frontmatter de `etat.md` court-circuite la
 * détection. C'est la porte de sortie pour les cas hybrides.
 */
import fs from "node:fs";
import path from "node:path";
import { normaliser } from "./markdown.mjs";

export const METHODES = {
  "graphify-code": {
    libelle: "projet-graphify-code",
    court: "graphify-code",
    quoi: "Gros projet de code : graphe AST sur le code + mémoire Karpathy",
  },
  graphify: {
    libelle: "projet-graphify",
    court: "graphify",
    quoi: "Gros projet général ou admin : mémoire Karpathy + couche machine optionnelle",
  },
  "starter-ui": {
    libelle: "starter-ui",
    court: "starter-ui",
    quoi: "Projet UI : Karpathy plus les skills designer intégrés",
  },
  karpathy: {
    libelle: "projet-karpathy",
    court: "karpathy",
    quoi: "Projet intermédiaire où le savoir s'accumule : index + pages courtes",
  },
  simple: {
    libelle: "projet-simple",
    court: "simple",
    quoi: "Projet léger : livrable one-shot, moins de cinq sessions",
  },
  aucune: {
    libelle: "hors méthode",
    court: "hors méthode",
    quoi: "Aucune méthode déployée : dossier de travail libre",
  },
};

/** Fichiers qui trahissent un projet de code, pour séparer les deux Graphify. */
const SIGNES_CODE = ["src", "package.json", "tsconfig.json", "index.tsx", "App.tsx", "pyproject.toml"];

export function detecterMethode(racine, frontmatter = {}) {
  const declaree = normaliserNom(frontmatter.methode ?? frontmatter["méthode"]);
  const a = (nom) => fs.existsSync(path.join(racine, nom));

  const indices = [];
  const noter = (condition, libelle) => {
    if (condition) indices.push(libelle);
    return condition;
  };

  const graphe = noter(a("graphify-out") || a(".graphifyignore"), "graphify-out/");
  const wiki = noter(a("wiki") && (a("WIKI.md") || a("HOME.md")), "WIKI.md + wiki/");
  const design = noter(a("design"), "design/");
  const brief = noter(a("BRIEF.md"), "BRIEF.md");
  const code = SIGNES_CODE.filter(a);
  if (code.length) indices.push(code.slice(0, 3).join(", "));
  if (a("bases")) indices.push("bases/");
  if (a("SOURCES")) indices.push("SOURCES/");

  let deduite = "aucune";
  if (graphe) deduite = code.length ? "graphify-code" : "graphify";
  else if (design && wiki) deduite = "starter-ui";
  else if (wiki) deduite = "karpathy";
  else if (brief) deduite = "simple";

  const nom = declaree ?? deduite;
  return {
    nom,
    ...METHODES[nom],
    source: declaree ? "déclarée" : deduite === "aucune" ? "aucune" : "déduite",
    indices,
    // Une méthode déclarée qui contredit le disque mérite d'être vue.
    divergence: declaree && deduite !== "aucune" && declaree !== deduite ? deduite : null,
  };
}

/** `projet-graphify-code`, `Graphify code`, `graphify-code` → la même clé. */
function normaliserNom(v) {
  if (!v) return null;
  const s = normaliser(v).replace(/^projet /, "").replace(/\s+/g, "-");
  if (METHODES[s]) return s;
  const alias = {
    "graphify-code": "graphify-code",
    "code-graphify": "graphify-code",
    ui: "starter-ui",
    "starter-ui": "starter-ui",
    simple: "simple",
    karpathy: "karpathy",
    graphify: "graphify",
    aucune: "aucune",
    none: "aucune",
  };
  return alias[s] ?? null;
}
