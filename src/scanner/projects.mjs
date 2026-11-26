/**
 * Assemblage d'un projet : la couche déclarative (`etat.md`, écrite à la main)
 * et la couche constatée (disque, git) réunies dans un seul objet, plus les
 * écarts entre les deux.
 *
 * Règle absolue : ce module lit, il n'écrit jamais dans un projet.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { separerFrontmatter, decouperSections, extrairePuces, premiereLigne, normaliser } from "./markdown.mjs";
import { sonderDossier, sonderGit, premierExistant, joursDepuis } from "./fs-probe.mjs";
import { uriOuverture, vaultDe } from "./obsidian.mjs";
import { construireOutilsProjet } from "./project-tools.mjs";
import { construireAgentsProjet } from "./project-agents.mjs";
import { detecterMethode } from "./methode.mjs";
import { lireBanc, croiserAvecCatalogue } from "./essais.mjs";

/** Emplacements acceptés pour le fichier d'état, par ordre de priorité. */
const CANDIDATS_ETAT = ["wiki/etat.md", "etat.md", "ETAT.md", "wiki/état.md"];

/** Fichiers de situation proposés en lien, par ordre de pertinence. */
const CANDIDATS_CLE = ["WIKI.md", "HOME.md", "CLAUDE.md", "BRIEF.md", "README.md", "JOURNAL.md"];

/** Intitulés de section reconnus → champ du modèle. */
const SECTIONS = {
  brief: "brief",
  "ou on en est": "ouOnEnEst",
  avancement: "ouOnEnEst",
  "dernieres sessions": "sessions",
  historique: "sessions",
  "prochaines etapes": "etapes",
  "arbitrages en attente": "arbitrages",
  arbitrages: "arbitrages",
  "points de vigilance": "vigilance",
  vigilance: "vigilance",
  liens: "liens",
  // Intitulés hérités : les etat.md écrits avant le contrat restent lisibles.
  fait: "sessions",
  "deja fait": "sessions",
  bloquant: "vigilance",
  bloquants: "vigilance",
  blocages: "vigilance",
  risques: "vigilance",
  "a faire": "etapes",
  "reste a faire": "etapes",
  suite: "etapes",
  "prochaines actions": "etapes",
  "questions ouvertes": "arbitrages",
  "a trancher": "arbitrages",
  "en attente": "arbitrages",
  "prochaines actions": "etapes",
  "prochaines echeances": "etapes",
  "chantiers en cours": "etapes",
};

/**
 * Reconnaissance tolérante des titres : « Prochaines actions (par priorité) »
 * doit tomber sur « prochaines actions ». Exact d'abord, puis préfixe le plus
 * long, sinon « en attente » raflerait « en attente de validation client ».
 */
const CLES_SECTIONS = Object.keys(SECTIONS).sort((a, b) => b.length - a.length);

function champDeTitre(titre) {
  const t = normaliser(titre);
  if (SECTIONS[t]) return SECTIONS[t];
  const cle = CLES_SECTIONS.find((k) => t.startsWith(k));
  return cle ? SECTIONS[cle] : null;
}

export function resoudreChemin(p) {
  return path.resolve(p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
}

/** Liste des dossiers candidats : auto-découverte + cibles manuelles. */
export function listerCibles(config) {
  const exclusions = new Set(config.exclusions ?? []);
  const cibles = new Map();

  for (const racineBrute of config.racinesAutoDecouvertes ?? []) {
    const racine = resoudreChemin(racineBrute);
    let entrees = [];
    try {
      entrees = fs.readdirSync(racine, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entrees) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      if (exclusions.has(e.name)) continue;
      // Dossiers créés par erreur à partir d'un prompt collé.
      if (e.name.length > 80) continue;
      // Copies de travail Agentastic (`<projet>-worktrees/`) : déjà montrées sur la page de leur projet.
      const parent = e.name.match(/^(.+)-worktrees$/)?.[1];
      if (parent && entrees.some((x) => x.isDirectory() && x.name === parent)) continue;

      const complet = path.join(racine, e.name);
      if (compterEntrees(complet) === 0) continue; // dossier vide

      cibles.set(complet, { chemin: complet, nom: e.name, domaine: null, source: "auto", essais: null, alias: [] });
    }
  }

  for (const cible of config.ciblesManuelles ?? []) {
    const complet = resoudreChemin(cible.chemin);
    if (!fs.existsSync(complet)) continue;
    cibles.set(complet, {
      chemin: complet,
      nom: cible.nom ?? path.basename(complet),
      domaine: cible.domaine ?? null,
      source: "manuelle",
      essais: cible.essais ?? null,
      alias: cible.alias ?? [],
      sousProjets: cible.sousProjets ?? [],
    });
  }

  // Un projet peut en contenir un autre (graphoo-v2 dans graphoo). Ce qui se
  // passe dans le plus précis lui revient à lui seul : son dossier et ses
  // copies de travail sont écartés du relevé et de l'usage du conteneur.
  const liste = [...cibles.values()];
  for (const c of liste) {
    c.imbriques = liste
      .filter((o) => o !== c && o.chemin.startsWith(c.chemin + path.sep))
      .flatMap((o) => [o.chemin, o.chemin + "-worktrees"]);
  }
  return liste;
}

function compterEntrees(dossier) {
  try {
    return fs.readdirSync(dossier).filter((n) => !n.startsWith(".")).length;
  } catch {
    return 0;
  }
}

/** Contenu d'un fichier, ou null s'il est absent. */
function lireTexte(fichier) {
  try {
    return fs.readFileSync(fichier, "utf8");
  } catch {
    return null;
  }
}

/** Lit et découpe un `etat.md`. Retourne null si le projet n'en a pas. */
function lireEtat(racine) {
  const trouve = premierExistant(racine, CANDIDATS_ETAT);
  if (!trouve) return null;

  let texte;
  try {
    texte = fs.readFileSync(trouve.absolu, "utf8");
  } catch {
    return null;
  }

  const { data, corps } = separerFrontmatter(texte);
  const brutes = decouperSections(corps);

  const sections = {};
  for (const [titre, contenu] of Object.entries(brutes)) {
    const champ = champDeTitre(titre);
    if (champ && !sections[champ]) sections[champ] = contenu;
  }

  return { fichier: trouve, frontmatter: data, sections };
}

/** Construit l'objet projet complet. */
export function construireProjet(cible, vaults, seuils, catalogue = []) {
  const etat = lireEtat(cible.chemin);
  const disque = sonderDossier(cible.chemin, 6, cible.imbriques ?? []);
  const git = sonderGit(cible.chemin);
  // Une copie de travail dont l'etat.md diffère : déclaratif en cours, pas encore acquis.
  for (const c of git?.copies ?? []) {
    const texteCopie = etat ? lireTexte(path.join(c.chemin, etat.fichier.relatif)) : null;
    c.etatModifie = texteCopie != null && texteCopie !== lireTexte(etat.fichier.absolu);
  }
  const fm = etat?.frontmatter ?? {};
  const sec = etat?.sections ?? {};

  const fichierCle =
    (fm["fichier-cle"] && premierExistant(cible.chemin, [String(fm["fichier-cle"])])) ||
    premierExistant(cible.chemin, CANDIDATS_CLE);

  const sessions = extrairePuces(sec.sessions);
  const etapes = extrairePuces(sec.etapes);
  const arbitrages = extrairePuces(sec.arbitrages);
  const vigilance = extrairePuces(sec.vigilance);

  const ouOnEnEst = premiereLigne(sec.ouOnEnEst) || premiereLigne(sec.brief);
  const resume = String(fm.resume ?? "") || ouOnEnEst;

  const projet = {
    id: slug(cible.chemin),
    nom: String(fm.projet ?? cible.nom),
    chemin: cible.chemin,
    source: cible.source,
    domaine: String(fm.domaine ?? cible.domaine ?? "") || null,
    // Icône déclarée par le projet lui-même ; sinon `config/targets.json`
    // en donne une par défaut (voir index.mjs), sinon le front prend celle
    // du domaine.
    icone: fm.icone ? String(fm.icone) : null,
    // Noms sous lesquels ce projet apparaît dans le champ « projet » des
    // retours d'usage : « portfolio » et « portfolio & digital card » sont le
    // même terrain, il ne faut pas en faire deux entrées d'historique.
    alias: [...new Set([cible.nom, ...(cible.alias ?? [])])],

    instrumente: !!etat,
    statut: normaliserStatut(fm.statut),
    // Méthode de travail appliquée : déclarée dans le frontmatter, sinon lue
    // sur la signature de fichiers laissée par le starter.
    methode: detecterMethode(cible.chemin, fm),
    // La description est ce que j'ai écrit, jamais un repli : elle s'affiche
    // sous le nom du projet et ne doit pas se remplir toute seule d'un bout
    // de section « Où on en est ».
    description: fm.resume ? String(fm.resume) : null,
    resume,
    ouOnEnEst,
    brief: sec.brief ?? null,
    avancement: Number.isFinite(fm.avancement) ? clamp(fm.avancement) : null,
    echeance: fm.echeance ? String(fm.echeance) : null,
    majDeclaree: fm.maj ? String(fm.maj) : null,

    sessions: sessions.slice(0, 12),
    etapes: etapes.filter((e) => e.fait !== true),
    etapesFaites: etapes.filter((e) => e.fait === true).length,
    // Les étapes cochées dans etat.md, pour la liste « Fait » de la vue projet.
    etapesCloses: etapes.filter((e) => e.fait === true),
    // Progression constatée sur les cases, à côté de `avancement:` déclaré.
    // Une puce sans case compte comme une étape ouverte : elle en est une.
    progression: etapes.length
      ? {
          faites: etapes.filter((e) => e.fait === true).length,
          total: etapes.length,
          pourcentage: Math.round((100 * etapes.filter((e) => e.fait === true).length) / etapes.length),
        }
      : null,
    arbitrages,
    vigilance,
    liensDeclares: extraireLiens(sec.liens, cible.chemin, vaults),

    disque: {
      ...disque,
      joursDepuisModif: joursDepuis(disque.derniereModif),
    },
    git,
    // Chemins des projets suivis à part qui vivent dans celui-ci, pour l'usage.
    imbriques: cible.imbriques ?? [],
    sousProjets: lireSousProjets(cible, vaults),

    // Outils branchés sur ce projet, distincts du catalogue transverse.
    outils: construireOutilsProjet(cible.chemin, catalogue, vaults),

    // Agents du projet (`.claude/agents/`) et commandes qui les orchestrent.
    agents: construireAgentsProjet(cible.chemin, vaults),

    // Banc d'essai : les évaluations menées dans ce projet, et l'état de leur
    // report vers l'archive des conclusions.
    banc: croiserAvecCatalogue(
      lireBanc(cible.chemin, cible.essais, vaults),
      catalogue,
      [...(cible.alias ?? []), cible.nom, path.basename(cible.chemin)]
    ),

    ouverture: {
      dossier: `file://${encodeURI(cible.chemin)}`,
      vault: vaultDe(cible.chemin, vaults)?.nom ?? null,
      etat: etat ? uriOuverture(etat.fichier.absolu, vaults) : null,
      fichierCle: fichierCle ? { ...uriOuverture(fichierCle.absolu, vaults), nom: fichierCle.relatif } : null,
    },
  };

  projet.alertes = calculerAlertes(projet, seuils);
  return projet;
}

/**
 * Les écarts entre déclaré et constaté. C'est le cœur de l'outil : le
 * dashboard signale la divergence au lieu de trancher à ma place.
 */
function calculerAlertes(p, seuils) {
  const alertes = [];
  const dormantApres = seuils?.joursAvantDormant ?? 30;

  if (!p.instrumente) {
    alertes.push({
      niveau: "info",
      code: "non-instrumente",
      texte: "Pas de fichier etat.md : ce projet n'apparaît qu'en métadonnées",
    });
  }

  if (p.statut === "actif" && p.disque.joursDepuisModif != null && p.disque.joursDepuisModif > dormantApres) {
    alertes.push({
      niveau: "attention",
      code: "dormant",
      texte: `Déclaré actif, mais rien n'a bougé depuis ${p.disque.joursDepuisModif} jours`,
    });
  }

  if (p.majDeclaree && p.disque.derniereModif) {
    const ecart = joursDepuis(p.majDeclaree) - (p.disque.joursDepuisModif ?? 0);
    if (ecart > 21) {
      alertes.push({
        niveau: "attention",
        code: "etat-perime",
        texte: `Le projet a bougé après la dernière mise à jour de etat.md (${p.majDeclaree})`,
      });
    }
  }

  if (p.echeance) {
    const restant = -joursDepuis(p.echeance);
    if (restant < 0) {
      alertes.push({ niveau: "urgent", code: "echeance-depassee", texte: `Échéance dépassée de ${-restant} jours` });
    } else if (restant <= 14) {
      alertes.push({ niveau: "urgent", code: "echeance-proche", texte: `Échéance dans ${restant} jours` });
    }
  }

  // Déclaré et constaté qui divergent : on le dit, on ne choisit pas. Sous
  // quatre étapes, un écart de 25 points ne veut rien dire.
  if (p.avancement != null && p.progression && p.progression.total >= 4) {
    const ecart = p.progression.pourcentage - p.avancement;
    if (Math.abs(ecart) > 25) {
      alertes.push({
        niveau: "info",
        code: "ecart-avancement",
        texte: `Avancement déclaré ${p.avancement} %, ${p.progression.faites}/${p.progression.total} étapes cochées (${p.progression.pourcentage} %)`,
      });
    }
  }

  if (p.arbitrages.length > 0) {
    alertes.push({
      niveau: "arbitrage",
      code: "arbitrage",
      texte: `${p.arbitrages.length} arbitrage${p.arbitrages.length > 1 ? "s" : ""} en attente`,
    });
  }

  const enCours = (p.git?.copies ?? []).filter((c) => c.aFusionner > 0 || c.fichiersModifies > 0 || c.etatModifie);
  if (enCours.length) {
    alertes.push({
      niveau: "info",
      code: "copie-non-fusionnee",
      texte: `${enCours.length} copie${enCours.length > 1 ? "s" : ""} de travail avec des changements pas encore fusionnés`,
    });
  }

  if (p.git && p.git.fichiersModifies > 0) {
    alertes.push({
      niveau: "info",
      code: "git-sale",
      texte: `${p.git.fichiersModifies} fichier(s) non commités`,
    });
  }

  return alertes;
}

/**
 * Sous-projets déclarés dans `config/targets.json` : des dossiers de la racine
 * qui ne méritent pas une tuile chacun, mais dont on veut voir s'ils bougent.
 * Même lecture que pour un projet, en plus court : relevé disque, git s'il y
 * en a un, et la fiche d'état si le dossier en a une. Rien n'est exigé.
 */
function lireSousProjets(cible, vaults) {
  const sous = [];
  for (const d of cible.sousProjets ?? []) {
    const chemin = path.join(cible.chemin, d.dossier);
    if (!fs.existsSync(chemin)) continue;
    const etat = lireEtat(chemin);
    const fm = etat?.frontmatter ?? {};
    const disque = sonderDossier(chemin, 6, cible.imbriques ?? []);
    const git = sonderGit(chemin);
    sous.push({
      dossier: d.dossier,
      nom: String(fm.projet ?? d.nom ?? d.dossier),
      role: d.role ?? null,
      resume: fm.resume ? String(fm.resume) : null,
      avancement: Number.isFinite(fm.avancement) ? clamp(fm.avancement) : null,
      majDeclaree: fm.maj ? String(fm.maj) : null,
      nbFichiers: disque.nbFichiers,
      derniereModif: disque.derniereModif,
      dernierFichier: disque.dernierFichier,
      joursDepuisModif: joursDepuis(disque.derniereModif),
      git: git ? { dernierCommit: git.dernierCommit, dernierMessage: git.dernierMessage, fichiersModifies: git.fichiersModifies } : null,
      nbSkills: compterEntrees(path.join(chemin, ".claude/skills")),
      ouverture: {
        dossier: `file://${encodeURI(chemin)}`,
        etat: etat ? uriOuverture(etat.fichier.absolu, vaults) : null,
      },
    });
  }
  return sous;
}

/** Liens `[libellé](chemin)` de la section Liens, résolus en URI ouvrables. */
function extraireLiens(bloc, racine, vaults) {
  if (!bloc) return [];
  const liens = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(bloc))) {
    const [, libelle, cible] = m;
    if (/^https?:/i.test(cible)) {
      liens.push({ libelle, uri: cible, type: "web" });
      continue;
    }
    const absolu = path.resolve(racine, "wiki", cible);
    const retenu = fs.existsSync(absolu) ? absolu : path.resolve(racine, cible);
    if (fs.existsSync(retenu)) liens.push({ libelle, ...uriOuverture(retenu, vaults) });
  }
  return liens;
}

function normaliserStatut(v) {
  const s = normaliser(v ?? "");
  if (["actif", "en cours", "actif "].includes(s)) return "actif";
  if (["en pause", "pause", "suspendu"].includes(s)) return "en-pause";
  if (["bloque", "bloquee"].includes(s)) return "bloque";
  if (["termine", "terminee", "fini", "clos"].includes(s)) return "termine";
  return s ? "actif" : "inconnu";
}

const clamp = (n) => Math.max(0, Math.min(100, Number(n)));
const slug = (p) =>
  path.basename(p).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
