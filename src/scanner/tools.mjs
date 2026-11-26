/**
 * Catalogue d'outils : croisement du déclaratif et du constaté.
 *
 * - Déclaratif : l'index `SKILLS.md` (classement, type, TL;DR) et les fiches
 *   `SKILLS/*.md` (statut, date de vérification, fonction).
 * - Constaté : ce qui est réellement posé sur la machine : skills dans
 *   `~/.claude/skills/`, plugins, serveurs MCP configurés, binaires du PATH.
 *
 * L'intérêt n'est pas la liste : c'est l'écart. « Déclaré actif, introuvable
 * sur la machine » et « installé, absent du catalogue » sont les deux lignes
 * qui valent le détour.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { separerFrontmatter, normaliser, texteNu, decouperSections } from "./markdown.mjs";
import { uriOuverture } from "./obsidian.mjs";
import { resoudreChemin } from "./projects.mjs";
import { joursDepuis } from "./fs-probe.mjs";

/** Suffixes décoratifs à retirer avant de comparer deux noms d'outil. */
const SUFFIXES = ["-mcp-server", "-mcp", "-server", "-skill", "-skills", "-cli"];

/** Dossiers d'infrastructure de Claude Code, qui ne sont pas des outils. */
const BRUIT = new Set(["synced", "cache", "data", "marketplaces", "known-marketplaces", "installed-plugins"]);

/**
 * Noms de paquets npm ou de binaires qui désignent un outil du catalogue sous
 * une autre étiquette. Sans ça, `framer-motion` et la fiche `motion` restent
 * deux inconnus l'un pour l'autre.
 */
const ALIAS = {
  "framer-motion": "motion",
  "playwright-mcp": "playwright",
  "playwright-core": "playwright",
  "chrome-devtools-mcp": "chrome-devtools",
  magic: "21st-dev-magic",
  "shadcn-ui-mcp-server": "shadcn-ui-mcp-server",
  graphifyy: "graphify",
  "graphify-mcp": "graphify",
  // AccessLint est le premier choix décrit dans la fiche wcag-audit.
  accesslint: "wcag-audit",
  // La fiche s'appelle three-js, le paquet npm three.
  "three-js": "three",
};

/**
 * Clé de rapprochement : `@playwright/mcp`, `playwright-mcp` et la fiche
 * `playwright` se rejoignent. Le dépouillement des suffixes boucle jusqu'à
 * stabilité : `shadcn-ui-mcp-server` en porte deux d'affilée.
 */
export function cleOutil(nom) {
  // `@playwright/mcp` : c'est le scope qui porte le nom, pas le paquet.
  let brut = String(nom).replace(/@latest$/, "");
  const scope = /^@([^/]+)\/(.+)$/.exec(brut);
  if (scope) brut = /^(mcp|core|cli|server)$/i.test(scope[2]) ? scope[1] : scope[2];

  let s = normaliser(brut).replace(/\s+/g, "-");
  // Un seul dépouillement, le suffixe le plus long d'abord : boucler
  // transformerait `shadcn-ui-mcp-server` en `shadcn` et fusionnerait deux
  // fiches distinctes du catalogue.
  for (const suf of SUFFIXES) {
    if (s.endsWith(suf) && s.length > suf.length) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  s = s.replace(/^-|-$/g, "");
  return ALIAS[s] ?? s;
}

/* ------------------------------------------------------------------ */
/* Déclaratif : l'index et les fiches                                  */
/* ------------------------------------------------------------------ */

/** Lit les tableaux de `SKILLS.md`, en gardant le H2 courant comme catégorie. */
function lireIndex(cheminIndex) {
  let texte;
  try {
    texte = fs.readFileSync(cheminIndex, "utf8");
  } catch {
    return [];
  }

  const lignes = texte.split(/\r?\n/);
  const entrees = [];
  let categorie = "Non classé";
  let colonnes = null;

  for (const ligne of lignes) {
    const h2 = /^##\s+(.+?)\s*$/.exec(ligne);
    if (h2) {
      categorie = h2[1];
      colonnes = null;
      continue;
    }
    if (!ligne.trim().startsWith("|")) {
      colonnes = null;
      continue;
    }

    // Le `\|` échappé du markdown est neutralisé AVANT le découpage, sinon un
    // wikilink avec alias (`[[a/b\|c]]`) casse la ligne en deux cellules.
    const cellules = ligne
      .replace(/\\\|/g, "\u0000")
      .split("|")
      .slice(1, -1)
      .map((c) => c.replace(/\u0000/g, "|").trim());
    if (cellules.length < 2) continue;
    if (cellules.every((c) => /^:?-{2,}:?$/.test(c))) continue; // ligne de séparation

    if (!colonnes) {
      colonnes = cellules.map((c) => normaliser(c));
      continue;
    }

    const champ = (...noms) => {
      for (const n of noms) {
        const i = colonnes.indexOf(n);
        if (i >= 0 && cellules[i]) return cellules[i];
      }
      return "";
    };

    const nom = nettoyerCellule(cellules[0]);
    if (!nom || nom.startsWith("[à venir")) continue;

    entrees.push({
      nom,
      categorie,
      type: nettoyerCellule(champ("type", "ce qu il pose")) || null,
      tldr: nettoyerCellule(champ("tl dr", "tldr")) || null,
      fiche: premierWikilink(champ("fiche", "fiche liee")),
    });
  }
  return entrees;
}

function nettoyerCellule(c) {
  return texteNu(String(c ?? ""));
}

function premierWikilink(cellule) {
  const m = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(String(cellule ?? ""));
  return m ? m[1].split("/")[0].trim() : null;
}

/** Ouvre la fiche d'un outil et en tire statut, date et fonction. */
function lireFiche(dossierFiches, nomFiche) {
  if (!nomFiche) return null;
  const chemin = path.join(dossierFiches, `${nomFiche}.md`);
  if (!fs.existsSync(chemin)) return null;

  let texte;
  try {
    texte = fs.readFileSync(chemin, "utf8");
  } catch {
    return null;
  }

  const { data, corps } = separerFrontmatter(texte);
  const retours = extraireRetours(corps);
  const fonction = /^-\s*\*\*Fonction\*\*\s*:\s*(.+)$/m.exec(corps)?.[1]?.trim() ?? null;
  const declencheurs = /^-\s*\*\*Déclencheurs\*\*\s*:\s*(.+)$/m.exec(corps)?.[1]?.trim() ?? null;
  const pieges = /^-\s*\*\*Pièges connus\*\*\s*:\s*(.+)$/m.exec(corps)?.[1]?.trim() ?? null;
  // `source : https://github.com/owner/repo` : sert à rattacher à la fiche les
  // skills installés depuis ce dépôt (`skills-lock.json` d'un projet).
  const depot = /source\s*:\s*https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)/i.exec(corps)?.[1]?.replace(/\.git$/, "").toLowerCase() ?? null;

  return {
    chemin,
    statut: data.statut ? String(data.statut) : null,
    maj: data.maj ? String(data.maj) : null,
    type: data.type ? String(data.type) : null,
    // Nettoyés comme les autres textes affichés : le dashboard rend du texte
    // brut, un `**gras**` ou un `[[wikilink]]` y passerait tel quel.
    fonction: tronquer(texteNu(fonction), 400),
    declencheurs: tronquer(texteNu(declencheurs), 240),
    pieges: tronquer(texteNu(pieges), 400),
    retours,
    depot,
  };
}

/**
 * Retours d'usage d'une fiche : la seule preuve qu'un outil a servi pour de vrai.
 *
 * Toutes les fiches portent la section, mais la plupart ne contiennent que sa
 * ligne-modèle (`> Une ligne par projet : AAAA-MM · …`). Le tri est net : une
 * entrée qui commence par une vraie date est un retour, le reste est le gabarit.
 */
function extraireRetours(corps) {
  // Découpage réutilisé plutôt qu'une regex maison : `\Z` n'existe pas en
  // JavaScript et se lisait comme un « Z » littéral.
  const bloc = decouperSections(corps)["retours d usage"];
  if (!bloc) return [];

  const retours = [];
  for (const ligne of bloc.split(/\r?\n/)) {
    // La puce est facultative : quatre fiches écrivent leurs retours en
    // paragraphes nus (`2026-08 · portfolio · …`). C'est la date qui fait foi,
    // pas le tiret.
    const m = /^\s*(?:[-*>]\s*)*(.*)$/.exec(ligne);
    if (!m) continue;
    const contenu = m[1].trim();
    const date = /^(\d{4}-\d{2}(?:-\d{2})?)\s*[·:\u2014-]\s*(.*)$/.exec(contenu);
    if (!date) continue; // ligne-modèle ou consigne, pas un retour

    // `2026-08 · portfolio · ce qui a marché` : le projet est le 2e segment.
    const reste = date[2];
    const coupe = /^([^·]{1,60})·\s*(.*)$/.exec(reste);
    let corps = coupe ? coupe[2] : reste;

    // Forme enrichie, écrite au moment du report d'un essai :
    // `date · projet · 4/5 · retenu · ce qui s'est passé`.
    // `?/5` = verdict posé, note pas encore donnée : c'est une attente, pas un oubli.
    let note = null;
    let issue = null;
    const enrichi = /^(\d(?:[.,]\d)?|\?)\s*\/\s*5\s*·\s*([^·]{1,24}?)\s*·\s*(.*)$/.exec(corps);
    if (enrichi) {
      note = enrichi[1] === "?" ? null : Number(enrichi[1].replace(",", "."));
      issue = normaliser(enrichi[2]);
      corps = enrichi[3];
    }

    retours.push({
      date: date[1],
      projet: coupe ? coupe[1].trim() : null,
      note,
      issue,
      texte: texteNu(corps),
    });
  }
  return retours;
}

const tronquer = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/* ------------------------------------------------------------------ */
/* Constaté : ce qui est réellement posé sur la machine                */
/* ------------------------------------------------------------------ */

export function detecterInstallations() {
  const home = os.homedir();
  const trouves = new Map();

  const ajouter = (nom, canal, detail) => {
    const cle = cleOutil(nom);
    if (!cle) return;
    if (!trouves.has(cle)) trouves.set(cle, { cle, nomsBruts: [], canaux: [], details: [] });
    const e = trouves.get(cle);
    if (!e.nomsBruts.includes(nom)) e.nomsBruts.push(nom);
    if (!e.canaux.includes(canal)) e.canaux.push(canal);
    if (detail && !e.details.includes(detail)) e.details.push(detail);
  };

  // Skills posés dans ~/.claude/skills/
  lireDossier(path.join(home, ".claude/skills")).forEach((n) => ajouter(n, "skill", "~/.claude/skills"));

  // Plugins installés
  try {
    const p = JSON.parse(fs.readFileSync(path.join(home, ".claude/plugins/installed_plugins.json"), "utf8"));
    for (const val of Object.values(p ?? {})) {
      const noms = Array.isArray(val) ? val : Object.keys(val ?? {});
      noms.forEach((n) => ajouter(String(n), "plugin", "plugins Claude Code"));
    }
  } catch { /* pas de plugins, cas normal */ }

  // Serveurs MCP déclarés
  try {
    const c = JSON.parse(fs.readFileSync(path.join(home, ".claude.json"), "utf8"));
    Object.keys(c.mcpServers ?? {}).forEach((n) => ajouter(n, "mcp", "~/.claude.json"));
  } catch { /* fichier absent */ }

  // Binaires dans les emplacements usuels
  for (const dir of [path.join(home, ".local/bin"), "/usr/local/bin", "/opt/homebrew/bin"]) {
    lireDossier(dir).forEach((n) => ajouter(n, "binaire", dir.replace(home, "~")));
  }

  return trouves;
}

function lireDossier(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => !n.startsWith("."));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Domaines : à quoi sert l'outil, par opposition à son rangement      */
/* ------------------------------------------------------------------ */

/**
 * Les catégories de `SKILLS.md` disent *où c'est rangé dans l'index*. Les
 * domaines disent *à quoi ça sert*, ce qui n'est pas la même question : un
 * outil vidéo peut être rangé sous « front & design ».
 *
 * Déduction par mots-clés sur le nom, le type, le TL;DR et la fonction ; un
 * outil peut relever de plusieurs domaines, ce qui est souvent la vérité.
 * `forcer` a le dernier mot, parce qu'aucune liste de mots-clés ne couvre
 * tous les cas sans en abîmer d'autres.
 */
function classerDomaines(outil, conf) {
  const forces = conf?.forcer?.[outil.cle];
  if (forces?.length) return [...forces];

  // La catégorie d'index est volontairement exclue : « Outils front & design »
  // contient le mot design, et rangeait tout son rayon dans ce domaine,
  // y compris chrome-devtools. Le domaine décrit l'outil, pas son étagère.
  const foin = " " + normaliser([outil.nom, outil.type, outil.tldr, outil.fonction].join(" "));
  const trouves = [];
  for (const [cle, regle] of Object.entries(conf?.regles ?? {})) {
    if ((regle.motifs ?? []).some((m) => debuteUnMot(foin, m))) trouves.push(cle);
  }
  return trouves;
}

/**
 * Un motif doit commencer un mot, pas se cacher au milieu d'un autre.
 * Sans cette règle, `ui` matchait « q-ui » et `ux` matchait « de-ux » : le
 * domaine design raflait 29 outils sur 48. Le préfixe reste permis, pour que
 * `anim` attrape « animation » et `accessibilit` les deux genres.
 */
function debuteUnMot(foin, motif) {
  const m = normaliser(motif);
  return m ? foin.includes(" " + m) : false;
}

/**
 * Une surcharge qui ne vise aucun outil ne fait rien, et ne dit rien.
 * Les clés sont dépouillées de leurs suffixes (`taste-skill` devient `taste`),
 * donc la faute est facile ; autant la signaler au scan.
 */
function verifierSurcharges(conf, outils) {
  const connues = new Set(outils.map((o) => o.cle));
  const orphelines = Object.keys(conf?.forcer ?? {}).filter((c) => !connues.has(c));
  if (orphelines.length) {
    console.warn(
      `domainesOutils.forcer : ${orphelines.length} clé(s) ne correspondent à aucun outil : ${orphelines.join(", ")}`
    );
  }
}

/** Libellés des domaines, pour que le front n'ait pas à les connaître. */
export function libellesDomaines(conf) {
  return Object.fromEntries(
    Object.entries(conf?.regles ?? {}).map(([cle, r]) => [cle, r.libelle ?? cle])
  );
}

/* ------------------------------------------------------------------ */
/* Croisement                                                          */
/* ------------------------------------------------------------------ */

export function construireOutils(config, vaults) {
  const cfg = config.catalogueOutils ?? {};
  const dossierFiches = resoudreChemin(cfg.dossierFiches ?? "");
  const cheminIndex = resoudreChemin(cfg.index ?? "");
  const perimeApres = config.seuils?.joursAvantFicheOutilPerimee ?? 180;

  const installes = detecterInstallations();
  const confDomaines = config.domainesOutils ?? {};
  const vus = new Set();
  const outils = [];

  for (const entree of lireIndex(cheminIndex)) {
    const cle = cleOutil(entree.nom);
    const fiche = lireFiche(dossierFiches, entree.fiche ?? entree.nom);
    const detecte = installes.get(cle) ?? null;
    if (detecte) vus.add(cle);

    const statutDeclare = normaliserStatutOutil(fiche?.statut);
    const outil = {
      cle,
      nom: entree.nom,
      categorie: entree.categorie,
      type: entree.type,
      tldr: entree.tldr,
      fonction: fiche?.fonction ?? null,
      declencheurs: fiche?.declencheurs ?? null,
      pieges: fiche?.pieges ?? null,

      statutDeclare,
      maj: fiche?.maj ?? null,
      aUneFiche: !!fiche,
      retours: fiche?.retours ?? [],
      eprouve: (fiche?.retours?.length ?? 0) > 0,

      detecte: !!detecte,
      canaux: detecte?.canaux ?? [],
      ou: detecte?.details ?? [],

      lienFiche: fiche ? uriOuverture(fiche.chemin, vaults) : null,
      depot: fiche?.depot ?? null,
    };

    outil.domaines = classerDomaines(outil, confDomaines);
    outil.etat = etatCroise(outil);
    outil.ecart = ecartDe(outil, perimeApres);
    outils.push(outil);
  }

  // Ce qui est sur la machine sans exister au catalogue.
  const orphelins = [];
  for (const [cle, detecte] of installes) {
    if (vus.has(cle) || BRUIT.has(cle)) continue;
    if (detecte.canaux.length === 1 && detecte.canaux[0] === "binaire") continue; // trop de bruit
    orphelins.push({
      cle,
      nom: detecte.nomsBruts[0],
      categorie: "Hors catalogue",
      type: detecte.canaux.join(", "),
      tldr: null,
      statutDeclare: null,
      aUneFiche: false,
      detecte: true,
      canaux: detecte.canaux,
      ou: detecte.details,
      domaines: [],
      etat: "hors-catalogue",
      ecart: "Installé sur la machine, absent de SKILLS.md, fiche à écrire ou outil à désinstaller",
      lienFiche: null,
    });
  }

  verifierSurcharges(confDomaines, outils);
  return { outils, orphelins, nbInstalles: installes.size };
}

/**
 * L'état affiché : ce qu'on sait vraiment, pas ce qui est écrit.
 * `actif` = déclaré actif ET trouvé. `declare-seul` = la fiche le dit, la
 * machine ne le confirme pas (cas fréquent des outils Cowork ou des libs).
 */
function etatCroise(o) {
  if (o.detecte && o.statutDeclare === "a-tester") return "installe-a-tester";
  if (o.detecte) return "actif";
  if (o.statutDeclare === "a-tester") return "a-tester";
  if (o.statutDeclare === "actif") return "declare-seul";
  return "catalogue";
}

function ecartDe(o, perimeApres) {
  if (o.etat === "declare-seul") {
    return "Déclaré actif dans sa fiche, non détecté sur cette machine";
  }
  if (o.aUneFiche && o.maj) {
    const j = joursDepuis(`${o.maj}${/^\d{4}-\d{2}$/.test(o.maj) ? "-01" : ""}`);
    if (j != null && j > perimeApres) return `Fiche non revérifiée depuis ${Math.floor(j / 30)} mois`;
  }
  if (!o.aUneFiche) return "Listé à l'index sans fiche détaillée";
  return null;
}

function normaliserStatutOutil(v) {
  const s = normaliser(v ?? "");
  if (!s) return null;
  if (s.includes("tester")) return "a-tester";
  if (s.includes("actif")) return "actif";
  if (s.includes("install")) return "installe";
  return s;
}
